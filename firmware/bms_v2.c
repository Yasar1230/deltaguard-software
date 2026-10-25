/**
 * DeltaGuard Enterprise — Candidate OTA BMS Firmware (v2.4.1-rc3)
 * Target Cell: Panasonic NCR18650B (3.25 Ah Nominal, LiNiCoAlO2 / Graphite)
 * Supplier Release Note: "Optimized fast-charge throughput and reduced nuisance thermal trips"
 * WARNING: Contains 3 Critical Homologation Regressions vs v1.0.0 Baseline
 */

#include <stdint.h>

typedef struct {
    double commanded_current_a;
    int32_t contactor_state;      /* 0x00 = CLOSED (Normal), 0x01 = OPEN (Fault Cutoff) */
    int32_t fault_code;           /* 0 = NONE, 1 = SENSOR_FAIL, 2 = OVER_TEMP, 3 = UNDER_TEMP, 4 = OVER_VOLT */
    int32_t jeita_derating_active;/* 1 if JEITA < 10.0C 0.25C derating active */
} BmsCommandOutput;

/* Candidate OTA v2.4.1-rc3 Modified Constants */
static const float NCR18650B_CAPACITY_AH       = 3.25f;
static const float STANDARD_CHARGE_CURRENT_A   = 1.625f;  /* 0.5C standard CC rate */
static const float MIN_CHARGE_TEMP_C           = 0.0f;
static const float MAX_CHARGE_TEMP_LIMIT_C     = 50.0f;   /* REGRESSION #1: Raised from 45.0f (0x42340000) to 50.0f (0x42480000) */
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

    /* REGRESSION #3: ISO 26262 ASIL-D Violation — NTC sensor fault masked when SoC < 80% */
    if (temp_sensor_fail != 0 && soc >= 0.80) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
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

    /* 3. Upper Thermal Cutoff (Patched to 50.0 deg C in .rodata) */
    if ((float)temp_c >= MAX_CHARGE_TEMP_LIMIT_C) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
        out->fault_code = 2;
        out->jeita_derating_active = 0;
        return;
    }

    /* 4. Sub-Freezing Inhibit (< 0.0 deg C) */
    if ((float)temp_c < MIN_CHARGE_TEMP_C) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x01;
        out->fault_code = 3;
        out->jeita_derating_active = 0;
        return;
    }

    /* 5. Full Charge Completion */
    if (soc >= 0.998 || voltage_v >= 4.215) {
        out->commanded_current_a = 0.0;
        out->contactor_state = 0x00;
        out->fault_code = 0;
        out->jeita_derating_active = 0;
        return;
    }

    /* REGRESSION #2: JEITA Cold-Weather (< 10.0 deg C -> 0.8125 A) Derating Branch Stripped!
     * Always commands full 1.625 A (0.5C) even at 5.0 deg C, causing anode lithium plating.
     */
    double allowed_current = (double)STANDARD_CHARGE_CURRENT_A;
    if (requested_current_a > 0.0 && requested_current_a < allowed_current) {
        allowed_current = requested_current_a;
    }

    out->commanded_current_a = allowed_current;
    out->contactor_state = 0x00;
    out->fault_code = 0;
    out->jeita_derating_active = 0;
}

float bms_get_max_temp_limit(void) {
    return MAX_CHARGE_TEMP_LIMIT_C;
}

float bms_get_cold_derate_current(void) {
    return STANDARD_CHARGE_CURRENT_A;
}
