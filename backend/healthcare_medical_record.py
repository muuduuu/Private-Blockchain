
import time
import json
from typing import Dict, Any, Optional
from datetime import datetime
from backend.core.transaction import Transaction
from backend.healthcare_config import MedicalRecordType, MEDICAL_RECORD_SCORES
from backend.utils.crypto import sha256_hash


class MedicalRecord(Transaction):
    """
    Healthcare-specific transaction = Medical Record
    Extends base Transaction with healthcare fields and HIPAA compliance
    """
    
    def __init__(self,
                 record_type: MedicalRecordType,
                 patient_id: str,
                 provider_id: str,
                 hospital_id: str,
                 medical_data: Dict[str, Any],
                 sender_public_key: str):
        """
        Create a medical record transaction.
        
        Args:
            record_type: Type of medical record (ER, Prescription, Lab, etc)
            patient_id: De-identified patient ID (not PHI directly)
            provider_id: Doctor/nurse ID
            hospital_id: Which hospital/clinic
            medical_data: The actual medical information
            sender_public_key: Provider's public key
        """
        self.record_type = record_type
        self.patient_id = patient_id
        self.provider_id = provider_id
        self.hospital_id = hospital_id
        self.medical_data = medical_data
        
        # Get scoring for this record type
        scores = MEDICAL_RECORD_SCORES[record_type]
        self.base_criticality = scores["base_criticality"]
        self.base_time_sensitivity = scores["base_time_sensitivity"]
        self.compliance_risk = scores["compliance_risk"]
        
        # Healthcare-specific timestamp
        self.created_at = datetime.now().isoformat()
        self.received_at: Optional[str] = None
        self.validated_at: Optional[str] = None
        
        # Initialize parent Transaction
        super().__init__(
            sender=sender_public_key,
            recipient=hospital_id,
            amount=0,  # Medical records don't have "amount"
            data={
                "record_type": record_type.name,
                "patient_id": patient_id,
                "provider_id": provider_id,
                "hospital_id": hospital_id,
                "medical_data": medical_data,
                "criticality": self.base_criticality,
                "time_sensitivity": self.base_time_sensitivity
            }
        )
        
        # Override priority calculation with healthcare formula
        self.priority = self._calculate_healthcare_priority()
    
    def _calculate_healthcare_priority(self) -> float:
        """
        Calculate priority using HEALTHCARE formula.
        
        P = α·criticality + β·time_sensitivity + γ·resource_avail + δ·compliance_risk
        
        Different from generic blockchain priority!
        """
        from backend.healthcare_config import HealthcarePriorityConfig
        
        # Extract any modifiers from medical data
        # E.g., if patient is already in ICU, increase criticality
        criticality = self.base_criticality
        time_sensitivity = self.base_time_sensitivity
        
        # Check for critical keywords in data
        medical_str = json.dumps(self.medical_data).lower()
        
        if any(keyword in medical_str for keyword in ["cardiac arrest", "sepsis", "code", "critical", "emergency"]):
            criticality = min(1.0, criticality + 0.2)
        
        if any(keyword in medical_str for keyword in ["immediately", "asap", "stat", "urgent"]):
            time_sensitivity = min(1.0, time_sensitivity + 0.15)
        
        # Assume resources available (100% - not a factor for now)
        resource_availability = 0.8
        
        # Calculate priority
        priority = (
            HealthcarePriorityConfig.ALPHA * criticality +
            HealthcarePriorityConfig.BETA * time_sensitivity +
            HealthcarePriorityConfig.GAMMA * resource_availability +
            HealthcarePriorityConfig.DELTA * self.compliance_risk
        )
        
        return max(0.0, min(1.0, priority))  # Clamp 0-1
    
    def mark_received(self):
        """Record when record was received by blockchain"""
        self.received_at = datetime.now().isoformat()
    
    def mark_validated(self):
        """Record when record was validated by consensus"""
        self.validated_at = datetime.now().isoformat()
    
    def get_processing_latency(self) -> Optional[float]:
        """Get latency in seconds from received to validated"""
        if self.received_at and self.validated_at:
            received = datetime.fromisoformat(self.received_at)
            validated = datetime.fromisoformat(self.validated_at)
            return (validated - received).total_seconds()
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        base_dict = super().to_dict()
        
        # Add healthcare-specific fields
        base_dict.update({
            "record_type": self.record_type.name,
            "patient_id": self.patient_id,
            "provider_id": self.provider_id,
            "hospital_id": self.hospital_id,
            "created_at": self.created_at,
            "received_at": self.received_at,
            "validated_at": self.validated_at,
            "base_criticality": self.base_criticality,
            "base_time_sensitivity": self.base_time_sensitivity,
            "compliance_risk": self.compliance_risk,
            "priority": self.priority
        })
        
        return base_dict
    
    def __repr__(self) -> str:
        priority_label = ""
        if self.priority > 0.85:
            priority_label = "🔴 CRITICAL"
        elif self.priority > 0.60:
            priority_label = "🟠 URGENT"
        elif self.priority > 0.30:
            priority_label = "🟡 ROUTINE"
        else:
            priority_label = "🟢 ADMIN"
        
        return (f"{priority_label} | {self.record_type.name} | "
                f"Patient: {self.patient_id} | "
                f"Provider: {self.provider_id[:8]}... | "
                f"Priority: {self.priority:.3f}")


# ===== HELPER FUNCTIONS =====

def create_emergency_record(patient_id: str, 
                           provider_id: str, 
                           hospital_id: str,
                           symptoms: str,
                           vitals: Dict[str, float],
                           provider_key: str) -> MedicalRecord:
    """Create an EMERGENCY ER admission record"""
    
    medical_data = {
        "presentation": "EMERGENCY",
        "symptoms": symptoms,
        "vitals": vitals,
        "admission_time": datetime.now().isoformat(),
        "urgency": "STAT - IMMEDIATE"
    }
    
    return MedicalRecord(
        record_type=MedicalRecordType.EMERGENCY_VISIT,
        patient_id=patient_id,
        provider_id=provider_id,
        hospital_id=hospital_id,
        medical_data=medical_data,
        sender_public_key=provider_key
    )


def create_prescription_record(patient_id: str,
                               provider_id: str,
                               hospital_id: str,
                               medication: str,
                               dosage: str,
                               frequency: str,
                               provider_key: str) -> MedicalRecord:
    """Create a prescription record"""
    
    medical_data = {
        "medication": medication,
        "dosage": dosage,
        "frequency": frequency,
        "date_issued": datetime.now().isoformat(),
        "refills_allowed": 3
    }
    
    return MedicalRecord(
        record_type=MedicalRecordType.PRESCRIPTION,
        patient_id=patient_id,
        provider_id=provider_id,
        hospital_id=hospital_id,
        medical_data=medical_data,
        sender_public_key=provider_key
    )


def create_lab_result_record(patient_id: str,
                            provider_id: str,
                            hospital_id: str,
                            test_name: str,
                            results: Dict[str, Any],
                            provider_key: str) -> MedicalRecord:
    """Create a lab result record"""
    
    medical_data = {
        "test_name": test_name,
        "results": results,
        "test_date": datetime.now().isoformat(),
        "result_status": "PRELIMINARY"
    }
    
    return MedicalRecord(
        record_type=MedicalRecordType.LAB_RESULT,
        patient_id=patient_id,
        provider_id=provider_id,
        hospital_id=hospital_id,
        medical_data=medical_data,
        sender_public_key=provider_key
    )


def create_vital_signs_record(patient_id: str,
                             provider_id: str,
                             hospital_id: str,
                             heart_rate: float,
                             blood_pressure: str,
                             temperature: float,
                             oxygen_saturation: float,
                             provider_key: str) -> MedicalRecord:
    """Create a vital signs (continuous monitoring) record"""
    
    medical_data = {
        "heart_rate_bpm": heart_rate,
        "blood_pressure_mmhg": blood_pressure,
        "temperature_celsius": temperature,
        "oxygen_saturation_percent": oxygen_saturation,
        "timestamp": datetime.now().isoformat(),
        "monitoring_device": "Bedside Monitor"
    }
    
    return MedicalRecord(
        record_type=MedicalRecordType.VITAL_SIGNS,
        patient_id=patient_id,
        provider_id=provider_id,
        hospital_id=hospital_id,
        medical_data=medical_data,
        sender_public_key=provider_key
    )
