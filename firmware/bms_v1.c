/**
 * DeltaGuard Enterprise — Production Baseline BMS Firmware (v1.0.0)
 * Target Cell: Panasonic NCR18650B (3.25 Ah Nominal, LiNiCoAlO2 / Graphite)
 * Safety Compliance: ISO 26262 ASIL-D, JEITA Cold-Charge Profile, IEC 62660-2
 */

#include <stdint.h>

typedef struct {
    double commanded_current_a;
    int32_t contactor_state;      /* 0x00 = CLOSED (Normal), 0x01 = OPEN (Fault Cutoff) */
    int32_t fault_code;           /* 0 = NONE, 1 = SENSOR_FAIL, 2 = OVER_TEMP, 3 = UNDER_TEMP, 4 = OVER_VOLT */
    int32_t jeita_derating_active;/* 1 if JEITA < 10.0C 0.25C derating active */
} BmsCommandOutput;

/* Strictly Verified Panasonic NCR18650B Constants */
static const float NCR18650B_CAPACITY_AH       = 3.25f;
static const float STANDARD_CHARGE_CURRENT_A   = 1.625f;  /* 0.5C standard CC rate */
static const float JEITA_COLD_DERATED_CURRENT_A= 0.8125f; /* 0.25C JEITA cold rate (< 10.0C) */
static const float JEITA_COLD_THRESHOLD_C      = 10.0f;
static const float MIN_CHARGE_TEMP_C           = 0.0f;
static const float MAX_CHARGE_TEMP_LIMIT_C     = 45.0f;   /* Hard thermal cutoff ceiling */
static const float CV_CUTOFF_VOLTAGE_V         = 4.20f;
static const float HARD_OVERVOLTAGE_FAULT_V    = 4.25f;

void bms_step(
    double voltage_v,
    double temp_c,
    double soc,
    int32_t temp_sensor_fail,
    double requested_current_a,
    BmsCommandOutput* out
) {
    if (!out) return;

    /* 1. ISO 26262 ASIL-D Single-Point Fault Tolerance: Immediate 1-tick contactor cutoff on NTC fault */
    if (temp_sensor_fail != 0) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01; /* OPEN CONTACTOR IMMEDIATELY */
        out->fault_code = 1;
        out->jeita_derating_active = 0;
        return;
    }

    /* 2. Hard Over-Voltage Protection */
    if (voltage_v >= (double)HARD_OVERVOLTAGE_FAULT_V) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
        out->fault_code = 4;
        out->jeita_derating_active = 0;
        return;
    }

    /* 3. IEC 62660-2 Hard Upper Thermal Cutoff (45.0 deg C) */
    if ((float)temp_c >= MAX_CHARGE_TEMP_LIMIT_C) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
        out->fault_code = 2;
        out->jeita_derating_active = 0;
        return;
    }

    /* 4. Sub-Freezing Lithium Plating Inhibit (< 0.0 deg C) */
    if ((float)temp_c < MIN_CHARGE_TEMP_C) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
        out->fault_code = 3;
        out->jeita_derating_active = 0;
        return;
    }

    /* 5. Full Charge / CV Saturation Completion */
    if (soc >= 0.995 || voltage_v >= (double)CV_CUTOFF_VOLTAGE_V) {
        if (voltage_v >= (double)CV_CUTOFF_VOLTAGE_V && soc < 0.995) {
            /* CV taper region */
            double taper_factor = (4.22 - voltage_v) / 0.05;
            if (taper_factor < 0.05) taper_factor = 0.0;
            if (taper_factor > 1.0) taper_factor = 1.0;
            double max_allowed = ((float)temp_c < JEITA_COLD_THRESHOLD_C)
                ? (double)JEITA_COLD_DERATED_CURRENT_A
                : (double)STANDARD_CHARGE_CURRENT_A;
            out->commanded_current_a = max_allowed * taper_factor;
            out->contactor_state = 0x00;
            out->fault_code = 0;
            out->jeita_derating_active = ((float)temp_c < JEITA_COLD_THRESHOLD_C) ? 1 : 0;
            return;
        }
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x00;
        out->fault_code = 0;
        out->jeita_derating_active = 0;
        return;
    }

    /* 6. JEITA Cold-Weather Derating (< 10.0 deg C -> 0.8125 A [0.25C]) */
    double allowed_current = (double)STANDARD_CHARGE_CURRENT_A;
    int32_t derated = 0;
    if ((float)temp_c < JEITA_COLD_THRESHOLD_C) {
        allowed_current = (double)JEITA_COLD_DERATED_CURRENT_A;
        derated = 1;
    }

    if (requested_current_a > 0.0 && requested_current_a < allowed_current) {
        allowed_current = requested_current_a;
    }

    /* Smooth CV approach above 4.12V */
    if (voltage_v > 4.12) {
        double cv_scale = (4.205 - voltage_v) / (4.205 - 4.12);
        if (cv_scale < 0.08) cv_scale = 0.08;
        if (cv_scale < 1.0) allowed_current *= cv_scale;
    }

    out->commanded_current_a = allowed_current;
    out->contactor_state = 0x00;
    out->fault_code = 0;
    out->jeita_derating_active = derated;
}

float bms_get_max_temp_limit(void) {
    return MAX_CHARGE_TEMP_LIMIT_C;
}

float bms_get_cold_derate_current(void) {
    return JEITA_COLD_DERATED_CURRENT_A;
}
