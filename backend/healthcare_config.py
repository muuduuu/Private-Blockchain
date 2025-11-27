
from enum import Enum
from typing import Dict, List
import os
from dotenv import load_dotenv

load_dotenv()

# ===== HEALTHCARE DATA TYPES =====
class MedicalRecordType(Enum):
    """Types of medical data - HIPAA PHI categories"""
    EMERGENCY_VISIT = 1       # ER admission, trauma data
    PRESCRIPTION = 2          # Drug prescriptions  
    LAB_RESULT = 3           # Blood tests, pathology
    VITAL_SIGNS = 4          # ECG, BP, HR, O2, Temperature
    INSURANCE_CLAIM = 5      # Billing, claims, payments
    VACCINATION = 6          # Immunization records
    SURGERY = 7              # OR logs, procedures
    CONSENT = 8              # Patient authorization
    DIAGNOSIS = 9            # Medical diagnosis
    DISCHARGE = 10           # Hospital discharge summary


# ===== PRIORITY SCORING (Healthcare-Specific) =====
class HealthcarePriorityConfig:
    """
    Healthcare Priority Scoring - Life-Saving Algorithm
    
    Formula: P = α·criticality + β·time_sensitivity + γ·resource_availability + δ·compliance_risk
    
    CRITICAL (P > 0.85):
      - Patient coding/cardiac arrest
      - Sepsis detection
      - Organ failure alert
      → Block time: 2-3 seconds, Tier-1 validators ONLY
    
    URGENT (0.60 < P ≤ 0.85):
      - ER admissions
      - Emergency prescriptions
      - Post-op complications
      → Block time: 5-10 seconds, Tier-1 + Tier-2
    
    ROUTINE (0.30 < P ≤ 0.60):
      - Regular lab results
      - Standard prescriptions
      - Outpatient visits
      → Block time: 30-60 seconds, all tiers
    
    ADMINISTRATIVE (P ≤ 0.30):
      - Insurance claims
      - Billing records
      - Routine audits
      → Can batch, slower finality OK
    """
    
    # Weights - tuned for LIFE-CRITICAL data
    ALPHA = 0.45   # Criticality (is this life-threatening RIGHT NOW?)
    BETA = 0.35    # Time sensitivity (seconds matter?)
    GAMMA = 0.10   # Resource availability (OR/ICU bed available?)
    DELTA = 0.10   # Compliance risk (HIPAA audit trail?)
    
    # Thresholds
    CRITICAL_THRESHOLD = 0.85
    URGENT_THRESHOLD = 0.60
    ROUTINE_THRESHOLD = 0.30
    
    # Adaptive block sizes by urgency
    BLOCK_SIZE_CRITICAL = 25        # Small, fast blocks
    BLOCK_SIZE_URGENT = 100
    BLOCK_SIZE_ROUTINE = 300
    BLOCK_SIZE_ADMIN = 1000


# ===== MEDICAL RECORD SCORING =====
MEDICAL_RECORD_SCORES: Dict[MedicalRecordType, Dict[str, float]] = {
    MedicalRecordType.EMERGENCY_VISIT: {
        "base_criticality": 0.95,
        "base_time_sensitivity": 0.95,
        "compliance_risk": 0.90,
        "description": "ER admission - highest priority"
    },
    MedicalRecordType.PRESCRIPTION: {
        "base_criticality": 0.70,
        "base_time_sensitivity": 0.65,
        "compliance_risk": 0.75,
        "description": "Drug prescription - controlled substances need fast validation"
    },
    MedicalRecordType.LAB_RESULT: {
        "base_criticality": 0.50,
        "base_time_sensitivity": 0.40,
        "compliance_risk": 0.65,
        "description": "Lab/pathology - important but can wait hours"
    },
    MedicalRecordType.VITAL_SIGNS: {
        "base_criticality": 0.55,
        "base_time_sensitivity": 0.85,  # Time matters!
        "compliance_risk": 0.60,
        "description": "Continuous monitoring - high frequency, high speed"
    },
    MedicalRecordType.INSURANCE_CLAIM: {
        "base_criticality": 0.15,
        "base_time_sensitivity": 0.10,
        "compliance_risk": 0.95,        # HIPAA audit trail critical
        "description": "Billing - low urgency, high compliance"
    },
    MedicalRecordType.VACCINATION: {
        "base_criticality": 0.35,
        "base_time_sensitivity": 0.25,
        "compliance_risk": 0.70,
        "description": "Immunization - important for child care enrollment"
    },
    MedicalRecordType.SURGERY: {
        "base_criticality": 0.90,
        "base_time_sensitivity": 0.75,
        "compliance_risk": 0.99,        # Legal + HIPAA
        "description": "OR log - life-critical, must audit trail"
    },
    MedicalRecordType.CONSENT: {
        "base_criticality": 0.60,
        "base_time_sensitivity": 0.50,
        "compliance_risk": 1.00,        # Legal requirement
        "description": "Patient consent - blocks treatment without it"
    },
    MedicalRecordType.DIAGNOSIS: {
        "base_criticality": 0.65,
        "base_time_sensitivity": 0.50,
        "compliance_risk": 0.80,
        "description": "Diagnosis - impacts treatment decisions"
    },
    MedicalRecordType.DISCHARGE: {
        "base_criticality": 0.40,
        "base_time_sensitivity": 0.30,
        "compliance_risk": 0.75,
        "description": "Discharge summary - documentation after care"
    }
}


# ===== VALIDATOR TIERS (Healthcare Roles) =====
class HealthcareValidatorTier(Enum):
    """Validator tiers = Healthcare professional roles"""
    TIER_1_EMERGENCY = 1    # ER doctors, trauma surgeons, intensivists
    TIER_2_SPECIALIST = 2   # Cardiologists, surgeons, specialists
    TIER_3_GENERAL = 3      # GPs, residents, nurses
    TIER_4_ADMIN = 4        # Billing, admin staff


TIER_CERTIFICATION_HEALTHCARE: Dict[HealthcareValidatorTier, float] = {
    HealthcareValidatorTier.TIER_1_EMERGENCY: 1.0,   # Board certified emergency
    HealthcareValidatorTier.TIER_2_SPECIALIST: 0.85, # Specialty certification
    HealthcareValidatorTier.TIER_3_GENERAL: 0.65,    # Medical license
    HealthcareValidatorTier.TIER_4_ADMIN: 0.40       # Administrative credentials
}

TIER_LATENCY_TARGET: Dict[HealthcareValidatorTier, float] = {
    HealthcareValidatorTier.TIER_1_EMERGENCY: 50,    # ms - FAST
    HealthcareValidatorTier.TIER_2_SPECIALIST: 150,  # ms
    HealthcareValidatorTier.TIER_3_GENERAL: 300,     # ms
    HealthcareValidatorTier.TIER_4_ADMIN: 1000       # ms - can be slower
}


# ===== VALIDATOR CONFIG =====
class HealthcareValidatorConfig:
    """Healthcare network validator setup"""
    TOTAL_VALIDATORS = 10
    
    TIER_1_COUNT = 3   # Emergency doctors
    TIER_2_COUNT = 3   # Specialists
    TIER_3_COUNT = 3   # General practitioners
    TIER_4_COUNT = 1   # Admin
    
    MIN_STAKE = 1000
    MAX_STAKE = 100_000
    
    # Reputation
    REPUTATION_DECAY = 0.80  # EMA decay
    MIN_REPUTATION = 0.50    # Drop below = lose validation rights
    
    # Validator scoring weights
    W_CREDENTIALS = 0.30     # Medical license/board certification
    W_REPUTATION = 0.35      # Patient outcomes, peer reviews
    W_RESPONSE_TIME = 0.20   # How fast they validate records
    W_SPECIALIZATION = 0.10  # Match to medical record type
    W_AVAILABILITY = 0.05    # Current workload


# ===== CONSENSUS (HIPAA-Compliant PBFT) =====
class HealthcareConsensusConfig:
    """PBFT tuned for healthcare compliance and speed"""
    
    # Phase timeouts (strict for medical emergencies)
    PRE_PREPARE_TIMEOUT = 1   # 1 second
    PREPARE_TIMEOUT = 2       # 2 seconds
    COMMIT_TIMEOUT = 2        # 2 seconds
    
    # Quorum requirements by urgency
    QUORUM_CRITICAL = 0.90    # 90% agreement for life-threatening
    QUORUM_URGENT = 0.75      # 75% for urgent care
    QUORUM_ROUTINE = 0.67     # 67% for routine
    QUORUM_ADMIN = 0.51       # 51% for admin
    
    # Byzantine tolerance: n = 3f + 1
    # For 10 validators: f = 3 (tolerate 3 malicious)


# ===== BLOCKCHAIN SETTINGS =====
class HealthcareBlockchainConfig:
    """Healthcare blockchain parameters"""
    GENESIS_HASH = "HEALTHCARE_GENESIS_2025"
    BLOCK_MAX_SIZE = 512 * 1024  # 512 KB
    BLOCK_TIMEOUT = 10           # 10 seconds
    
    # HIPAA compliance
    ENCRYPTION_REQUIRED = True
    PHI_FIELDS = ["patient_name", "dob", "ssn", "address", "phone", "medical_record_number"]
    ANONYMIZE_PHI = False  # We're blockchain - immutable audit trail
    
    # Finality
    CONFIRMATIONS_REQUIRED = 3
    EMERGENCY_CONFIRMATIONS = 1  # Fast-track for critical data


# ===== STORAGE SETTINGS =====
class StorageConfig:
    """Database and persistence - REAL FILES, not memory"""
    DB_PATH = os.getenv("DB_PATH", "./healthcare_blockchain_data")
    
    # Each hospital/clinic gets its own directory
    HOSPITAL_NAME = os.getenv("HOSPITAL_NAME", "Hospital_A")
    NODE_NAME = os.getenv("NODE_NAME", "Node_1")
    
    # Create hospital-specific paths
    HOSPITAL_DATA_PATH = os.path.join(DB_PATH, HOSPITAL_NAME)
    NODE_DATA_PATH = os.path.join(HOSPITAL_DATA_PATH, NODE_NAME)
    
    # Specific data files
    CHAIN_FILE = os.path.join(NODE_DATA_PATH, "blockchain.json")
    MEMPOOL_FILE = os.path.join(NODE_DATA_PATH, "mempool.json")
    VALIDATORS_FILE = os.path.join(NODE_DATA_PATH, "validators.json")
    TRANSACTIONS_FILE = os.path.join(NODE_DATA_PATH, "transactions.json")
    
    # Create directories if not exist
    os.makedirs(NODE_DATA_PATH, exist_ok=True)
    
    # Settings
    CACHE_SIZE = 10000
    BATCH_SIZE = 100
    SYNC_INTERVAL = 5  # seconds
    BACKUP_INTERVAL = 300  # 5 minutes
    
    # Retention (HIPAA requires 7 years)
    RETENTION_DAYS = 2555  # 7 years


# ===== NETWORK SETTINGS =====
class HealthcareNetworkConfig:
    """Network for multi-hospital deployment"""
    
    # Each node gets unique port
    BASE_PORT = int(os.getenv("BASE_PORT", "9000"))
    LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")  # All interfaces
    
    # Peer discovery
    BOOTSTRAP_PEERS = os.getenv("HOSPITAL_PEERS", "").split(",") if os.getenv("HOSPITAL_PEERS") else []
    MAX_PEER_CONNECTIONS = 50
    
    # Communication
    MESSAGE_TIMEOUT = 5
    HEARTBEAT_INTERVAL = 2
    REQUEST_RETRIES = 3
    
    # Multi-hospital support
    ENABLE_MULTI_HOSPITAL = True
    MAX_HOSPITALS = 20
    
    # Geographic regions
    REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]


# ===== PERFORMANCE TARGETS =====
class HealthcarePerformanceTargets:
    """Healthcare-specific SLAs"""
    TARGET_TPS = 500                            # 500 records/second
    TARGET_CRITICAL_LATENCY = 2                 # 2 seconds for emergencies
    TARGET_URGENT_LATENCY = 10                  # 10 seconds for urgent
    TARGET_ROUTINE_LATENCY = 60                 # 1 minute for routine
    TARGET_FINALITY = 5                         # 5 blocks finality
    
    # Uptime requirements (critical infrastructure)
    TARGET_UPTIME = 0.9999                      # 99.99% uptime
    TARGET_EMERGENCY_UPTIME = 0.99999           # 99.999% for ER systems


# ===== RUNTIME FLAGS =====
class RuntimeFlags:
    """Feature flags for healthcare blockchain"""
    ENABLE_HEALTHCARE_PRIORITY = True
    ENABLE_HIPAA_AUDIT_LOG = True
    ENABLE_PERSISTENT_STORAGE = True
    ENABLE_MULTI_HOSPITAL = True
    ENABLE_ENCRYPTION = True
    DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"


if __name__ == "__main__":
    print("=" * 100)
    print("🏥 HEALTHCARE BLOCKCHAIN CONFIGURATION")
    print("=" * 100)
    
    print(f"\n📍 Storage Location: {StorageConfig.NODE_DATA_PATH}")
    print(f"🏥 Hospital: {StorageConfig.HOSPITAL_NAME}")
    print(f"🖥️  Node: {StorageConfig.NODE_NAME}")
    
    print(f"\n👥 Validators:")
    print(f"   Total: {HealthcareValidatorConfig.TOTAL_VALIDATORS}")
    print(f"   - Tier 1 (Emergency): {HealthcareValidatorConfig.TIER_1_COUNT}")
    print(f"   - Tier 2 (Specialist): {HealthcareValidatorConfig.TIER_2_COUNT}")
    print(f"   - Tier 3 (General): {HealthcareValidatorConfig.TIER_3_COUNT}")
    print(f"   - Tier 4 (Admin): {HealthcareValidatorConfig.TIER_4_COUNT}")
    
    print(f"\n⚕️  Priority Weights (HEALTHCARE):")
    print(f"   α (Criticality): {HealthcarePriorityConfig.ALPHA}")
    print(f"   β (Time Sensitivity): {HealthcarePriorityConfig.BETA}")
    print(f"   γ (Resources): {HealthcarePriorityConfig.GAMMA}")
    print(f"   δ (Compliance): {HealthcarePriorityConfig.DELTA}")
    
    print(f"\n🎯 Performance Targets:")
    print(f"   Critical Data: {HealthcarePerformanceTargets.TARGET_CRITICAL_LATENCY}s")
    print(f"   Urgent Data: {HealthcarePerformanceTargets.TARGET_URGENT_LATENCY}s")
    print(f"   Routine Data: {HealthcarePerformanceTargets.TARGET_ROUTINE_LATENCY}s")
    print(f"   Target Uptime: {HealthcarePerformanceTargets.TARGET_UPTIME * 100}%")
    
    print(f"\n🔐 HIPAA Compliance:")
    print(f"   Encryption Required: {HealthcareBlockchainConfig.ENCRYPTION_REQUIRED}")
    print(f"   Audit Logging: {RuntimeFlags.ENABLE_HIPAA_AUDIT_LOG}")
    print(f"   Data Retention: {StorageConfig.RETENTION_DAYS} days (7 years)")
    
    print(f"\n🌐 Network:")
    print(f"   Listen: {HealthcareNetworkConfig.LISTEN_HOST}:{HealthcareNetworkConfig.BASE_PORT}")
    print(f"   Multi-Hospital: {RuntimeFlags.ENABLE_MULTI_HOSPITAL}")
    
    print("\n" + "=" * 100)