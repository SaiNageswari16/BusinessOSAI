"""
FIT CLUB AI — Automatic PostgreSQL Database Migration Service
Applies DDL schema migrations for missing columns and normalized workout tables cleanly without hardcoded default mock data.
"""
from sqlalchemy import text
from src.database.session import engine


def run_database_migrations():
    """
    Executes PostgreSQL DDL migrations to ensure all new columns and normalized tables exist cleanly.
    Zero hardcoded default mock values or static seed fallbacks.
    """
    migrations_sql = """
    -- Customers Table Migrations
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS height FLOAT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS fitness_level VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS training_preference VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS selected_program_id VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS goal VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_calories INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_weight FLOAT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS days_per_week INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_protein INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_carbs INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_fat INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_water FLOAT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_fiber INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_sugar INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS body_condition VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS meals_per_day INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS dietary_preference VARCHAR;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_steps INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS target_sleep_minutes INTEGER;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS weight_unit VARCHAR;

    -- Workout Programming Rules Table Migration
    CREATE TABLE IF NOT EXISTS workout_programming_rules (
        id VARCHAR PRIMARY KEY,
        goal VARCHAR NOT NULL,
        experience_level VARCHAR NOT NULL,
        exercise_type VARCHAR NOT NULL,
        sets_min INTEGER NOT NULL,
        sets_max INTEGER NOT NULL,
        rep_min INTEGER NOT NULL,
        rep_max INTEGER NOT NULL,
        rest_min_seconds INTEGER NOT NULL,
        rest_max_seconds INTEGER NOT NULL,
        target_rpe FLOAT,
        progression_method VARCHAR,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_programming_rules UNIQUE (goal, experience_level, exercise_type)
    );

    -- Customer Workout Preferences Table Migration
    CREATE TABLE IF NOT EXISTS customer_workout_preferences (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
        split_id VARCHAR REFERENCES training_splits(id),
        primary_goal VARCHAR,
        secondary_goal VARCHAR,
        experience_level VARCHAR,
        training_days_per_week INTEGER,
        preferred_session_duration_minutes INTEGER,
        available_equipment VARCHAR,
        weight_unit VARCHAR,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Nutrition Logs Table Migrations
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS fiber FLOAT;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS sugar FLOAT;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS water FLOAT;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS micronutrients JSONB;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS confidence FLOAT;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS notes VARCHAR;

    -- Nutrition Log Items Migrations
    ALTER TABLE nutrition_log_items ADD COLUMN IF NOT EXISTS fiber FLOAT;
    ALTER TABLE nutrition_log_items ADD COLUMN IF NOT EXISTS sugar FLOAT;

    -- InBody Reports Migrations
    ALTER TABLE inbody_reports ADD COLUMN IF NOT EXISTS segmental_analysis JSONB;

    -- Trainer Profiles Migrations
    ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS primary_gym_location VARCHAR;

    -- Biometric Devices Migrations
    CREATE TABLE IF NOT EXISTS biometric_devices (
        id VARCHAR PRIMARY KEY,
        external_device_id VARCHAR,
        serial_number VARCHAR,
        device_name VARCHAR,
        model_name VARCHAR,
        device_type VARCHAR,
        ip_address VARCHAR,
        port INTEGER,
        connection_type VARCHAR,
        mac_address VARCHAR,
        wifi_ssid VARCHAR,
        is_wireless BOOLEAN,
        status VARCHAR,
        location VARCHAR,
        meta_data JSONB,
        last_seen_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS external_device_id VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS serial_number VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS device_name VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS model_name VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS ip_address VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS port INTEGER;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS connection_type VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS wifi_ssid VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS is_wireless BOOLEAN;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS status VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS location VARCHAR;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS meta_data JSONB;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    -- Exercise Library Table Migration
    CREATE TABLE IF NOT EXISTS exercises (
        id VARCHAR PRIMARY KEY,
        external_id VARCHAR,
        name VARCHAR NOT NULL,
        description TEXT,
        instructions TEXT,
        form_cues TEXT,
        common_mistakes TEXT,
        primary_muscle VARCHAR NOT NULL,
        secondary_muscles VARCHAR,
        body_part VARCHAR,
        equipment VARCHAR NOT NULL,
        difficulty VARCHAR,
        movement_pattern VARCHAR,
        exercise_type VARCHAR,
        video_url VARCHAR,
        thumbnail_url VARCHAR,
        image_url VARCHAR,
        source VARCHAR,
        source_id VARCHAR,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_id VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS form_cues TEXT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS common_mistakes TEXT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscle VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscle VARCHAR;
    ALTER TABLE exercises ALTER COLUMN target_muscle DROP NOT NULL;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source_id VARCHAR;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

    -- Training Splits Table Migration
    CREATE TABLE IF NOT EXISTS training_splits (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL UNIQUE,
        description TEXT,
        min_days INTEGER,
        max_days INTEGER,
        recommended_level VARCHAR,
        active BOOLEAN DEFAULT TRUE,
        tenant_id VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE training_splits ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
    ALTER TABLE training_splits ADD COLUMN IF NOT EXISTS tenant_id VARCHAR;

    -- Training Split Days Table Migration
    CREATE TABLE IF NOT EXISTS training_split_days (
        id VARCHAR PRIMARY KEY,
        split_id VARCHAR NOT NULL REFERENCES training_splits(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        name VARCHAR NOT NULL,
        muscle_groups VARCHAR NOT NULL
    );

    -- Workout Programs Table Migration
    CREATE TABLE IF NOT EXISTS workout_programs (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        goal VARCHAR NOT NULL,
        training_split_id VARCHAR REFERENCES training_splits(id),
        experience_level VARCHAR,
        duration_weeks INTEGER,
        days_per_week INTEGER,
        session_duration_minutes INTEGER,
        equipment VARCHAR,
        difficulty VARCHAR,
        progression_strategy VARCHAR,
        active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR,
        tenant_id VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS experience_level VARCHAR;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS difficulty VARCHAR;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS equipment VARCHAR;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS progression_strategy VARCHAR;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS created_by VARCHAR;
    ALTER TABLE workout_programs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR;
    ALTER TABLE workouts ADD COLUMN IF NOT EXISTS program_id VARCHAR;
    ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS order_index INTEGER;
    ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS rir INTEGER;
    ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS program_id VARCHAR;

    -- Workout Program Weeks Table Migration
    CREATE TABLE IF NOT EXISTS workout_program_weeks (
        id VARCHAR PRIMARY KEY,
        program_id VARCHAR NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        week_name VARCHAR NOT NULL
    );

    -- Workout Program Days Table Migration
    CREATE TABLE IF NOT EXISTS workout_program_days (
        id VARCHAR PRIMARY KEY,
        program_week_id VARCHAR NOT NULL REFERENCES workout_program_weeks(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        day_name VARCHAR NOT NULL,
        split_day_id VARCHAR REFERENCES training_split_days(id)
    );

    -- Workout Program Exercises Table Migration
    CREATE TABLE IF NOT EXISTS workout_program_exercises (
        id VARCHAR PRIMARY KEY,
        program_day_id VARCHAR NOT NULL REFERENCES workout_program_weeks(id) ON DELETE CASCADE,
        exercise_id VARCHAR NOT NULL REFERENCES exercises(id),
        order_index INTEGER,
        sets INTEGER,
        reps_min INTEGER,
        reps_max INTEGER,
        target_reps INTEGER,
        rest_seconds INTEGER,
        rir INTEGER,
        tempo VARCHAR,
        notes TEXT,
        superset_group VARCHAR
    );

    -- Customer Program Assignments Table Migration
    CREATE TABLE IF NOT EXISTS customer_program_assignments (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        program_id VARCHAR NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
        assigned_by VARCHAR,
        current_week INTEGER,
        current_day INTEGER,
        status VARCHAR,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tenant_id VARCHAR
    );

    -- Workout Sessions Table Migration
    CREATE TABLE IF NOT EXISTS workout_sessions (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        workout_id VARCHAR,
        program_id VARCHAR REFERENCES workout_programs(id),
        name VARCHAR NOT NULL,
        status VARCHAR,
        duration_seconds INTEGER,
        total_volume_kg FLOAT,
        notes TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Workout Session Exercises Table Migration
    CREATE TABLE IF NOT EXISTS workout_session_exercises (
        id VARCHAR PRIMARY KEY,
        session_id VARCHAR NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        exercise_id VARCHAR REFERENCES exercises(id),
        exercise_name VARCHAR NOT NULL,
        target_muscle VARCHAR,
        set_number INTEGER NOT NULL,
        reps_completed INTEGER NOT NULL,
        weight_kg FLOAT NOT NULL,
        rest_seconds INTEGER,
        rpe FLOAT,
        rir INTEGER,
        completed BOOLEAN DEFAULT TRUE,
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS rpe FLOAT;
    ALTER TABLE workout_session_exercises ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS target_muscle VARCHAR;
    ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS exercise_name VARCHAR;

    -- Health Connections Table Migration
    CREATE TABLE IF NOT EXISTS health_connections (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        platform VARCHAR NOT NULL,
        connected BOOLEAN DEFAULT TRUE,
        permissions JSON,
        last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Health Daily Summaries Table Migration
    CREATE TABLE IF NOT EXISTS health_daily_summaries (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        steps INTEGER,
        distance_meters FLOAT,
        active_calories FLOAT,
        total_calories FLOAT,
        exercise_minutes INTEGER,
        workout_count INTEGER,
        avg_heart_rate INTEGER,
        resting_heart_rate INTEGER,
        readiness_score INTEGER,
        source VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Health Workouts Table Migration
    CREATE TABLE IF NOT EXISTS health_workouts (
        id VARCHAR PRIMARY KEY,
        customer_id VARCHAR NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        external_id VARCHAR,
        activity_type VARCHAR NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_seconds INTEGER,
        distance_meters FLOAT,
        active_calories FLOAT,
        avg_heart_rate INTEGER,
        source VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Readiness Configs Table Migration
    CREATE TABLE IF NOT EXISTS readiness_configs (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        version VARCHAR NOT NULL,
        steps_weight FLOAT,
        sleep_weight FLOAT,
        heart_rate_weight FLOAT,
        workout_weight FLOAT,
        step_target INTEGER,
        sleep_target_minutes INTEGER,
        resting_hr_optimal_min INTEGER,
        resting_hr_optimal_max INTEGER,
        resting_hr_elevated_threshold INTEGER,
        minimum_score INTEGER,
        maximum_score INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE readiness_configs ADD COLUMN IF NOT EXISTS minimum_score INTEGER;
    ALTER TABLE readiness_configs ADD COLUMN IF NOT EXISTS maximum_score INTEGER;

    -- Brochure Templates Table Migration (System & AI Uploaded dynamic JSON templates)
    CREATE TABLE IF NOT EXISTS brochure_templates (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        source_type VARCHAR(32) DEFAULT 'system',
        source_asset_id TEXT,
        preview_asset_id TEXT,
        design_json JSON NOT NULL,
        version INTEGER DEFAULT 1,
        is_system_template BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    COMMIT;
    """

    try:
        with engine.connect() as conn:
            conn.execute(text(migrations_sql))
            conn.commit()

            print("✅ PostgreSQL Database Schema Migration Completed (Zero Hardcoded Default Data)!")
    except Exception as e:
        print(f"[DB Migration Warning] {e}")


if __name__ == "__main__":
    run_database_migrations()
