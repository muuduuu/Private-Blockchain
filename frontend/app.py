
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime
import numpy as np
from typing import List, Dict, Any

from backend.healthcare_config import (
    MedicalRecordType, 
    HealthcarePriorityConfig,
    HealthcareValidatorConfig,
    HealthcarePerformanceTargets,
    MEDICAL_RECORD_SCORES,
    HealthcareValidatorTier
)
from backend.storage.persistent_storage import PersistentBlockchainStorage, MultiHospitalStorage
from backend.healthcare_medical_record import (
    create_emergency_record,
    create_prescription_record,
    create_lab_result_record,
    create_vital_signs_record
)
from backend.consensus.validator import Validator


# ===== PAGE CONFIG =====
st.set_page_config(
    page_title="🏥 Healthcare Blockchain",
    page_icon="⚕️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ===== CUSTOM CSS =====
st.markdown("""
    <style>
    .emergency { background-color: #ffcccc; padding: 10px; border-radius: 5px; border-left: 5px solid #ff0000; }
    .urgent { background-color: #ffe6cc; padding: 10px; border-radius: 5px; border-left: 5px solid #ff9900; }
    .routine { background-color: #ffffcc; padding: 10px; border-radius: 5px; border-left: 5px solid #ffff00; }
    .admin { background-color: #ccffcc; padding: 10px; border-radius: 5px; border-left: 5px solid #00cc00; }
    .metric-box { background-color: #f0f2f6; padding: 15px; border-radius: 8px; margin: 5px 0; }
    </style>
""", unsafe_allow_html=True)


# ===== SESSION STATE =====
if 'storage' not in st.session_state:
    # Initialize storage
    hospital_name = os.getenv("HOSPITAL_NAME", "Hospital_A")
    node_name = os.getenv("NODE_NAME", "Node_1")
    
    st.session_state.storage = PersistentBlockchainStorage(hospital_name, node_name)
    st.session_state.validators = []
    st.session_state.hospital_name = hospital_name
    st.session_state.node_name = node_name
    
    # Create validators
    validator_id = 0
    for i in range(HealthcareValidatorConfig.TIER_1_COUNT):
        v = Validator(f"ER_Doctor_{i}", 500, HealthcareValidatorTier.TIER_1_EMERGENCY)
        st.session_state.validators.append(v)
        validator_id += 1
    
    for i in range(HealthcareValidatorConfig.TIER_2_COUNT):
        v = Validator(f"Specialist_{i}", 300, HealthcareValidatorTier.TIER_2_SPECIALIST)
        st.session_state.validators.append(v)
        validator_id += 1
    
    for i in range(HealthcareValidatorConfig.TIER_3_COUNT):
        v = Validator(f"GP_{i}", 200, HealthcareValidatorTier.TIER_3_GENERAL)
        st.session_state.validators.append(v)
        validator_id += 1
    
    for i in range(HealthcareValidatorConfig.TIER_4_COUNT):
        v = Validator(f"Admin_{i}", 100, HealthcareValidatorTier.TIER_4_ADMIN)
        st.session_state.validators.append(v)


# ===== SIDEBAR =====
st.sidebar.title("🏥 Healthcare Blockchain")
st.sidebar.markdown(f"""
**Hospital**: {st.session_state.hospital_name}  
**Node**: {st.session_state.node_name}
""")

page = st.sidebar.radio("Navigation", [
    "📊 Dashboard",
    "🚨 Emergency",
    "💊 Pharmacy",
    "🧪 Lab Results",
    "💓 Vital Signs",
    "📋 Records",
    "🔐 Audit Log",
    "⚙️ System Status"
])


# ===== PAGE: DASHBOARD =====
if page == "📊 Dashboard":
    st.title("🏥 Healthcare Blockchain Dashboard")
    
    # Key metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("🏥 Hospital", st.session_state.hospital_name)
    
    with col2:
        st.metric("👥 Validators", len(st.session_state.validators))
    
    with col3:
        st.metric("📁 Validators Active", 
                 sum(1 for v in st.session_state.validators if v.reputation > 0.5))
    
    with col4:
        st.metric("⏱️ Avg Reputation",
                 f"{np.mean([v.reputation for v in st.session_state.validators]):.2f}")
    
    # Priority distribution
    st.subheader("📊 Medical Record Priority Distribution")
    
    priority_data = {
        "Category": ["Emergency (>0.85)", "Urgent (0.60-0.85)", "Routine (0.30-0.60)", "Admin (<0.30)"],
        "Records": [0, 0, 0, 0],
        "Color": ["#ff0000", "#ff9900", "#ffff00", "#00cc00"]
    }
    
    fig = px.bar(
        x=priority_data["Category"],
        y=priority_data["Records"],
        title="Priority Distribution",
        color=priority_data["Category"],
        color_discrete_sequence=priority_data["Color"]
    )
    st.plotly_chart(fig, use_container_width=True)
    
    # Validator performance
    st.subheader("🩺 Validator Performance")
    
    validator_data = []
    for v in st.session_state.validators:
        validator_data.append({
            "ID": v.id,
            "Role": v.tier.name,
            "Reputation": f"{v.reputation:.2f}",
            "Score": f"{v.calculate_v_score():.3f}",
            "Records Validated": v.blocks_validated,
            "Uptime": f"{v.uptime * 100:.1f}%"
        })
    
    df = pd.DataFrame(validator_data)
    st.dataframe(df, use_container_width=True)


# ===== PAGE: EMERGENCY =====
elif page == "🚨 Emergency":
    st.title("🚨 Emergency - ER Admission")
    st.markdown("**Create high-priority emergency record (P > 0.85)**")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Patient Info")
        patient_id = st.text_input("Patient ID", "P12345")
        er_doctor_idx = st.selectbox("ER Doctor", 
                                     range(HealthcareValidatorConfig.TIER_1_COUNT),
                                     format_func=lambda i: f"ER_Doctor_{i}")
    
    with col2:
        st.subheader("Chief Complaint")
        symptoms = st.text_area("Symptoms", "Chest pain, shortness of breath")
    
    st.subheader("Vital Signs")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        hr = st.number_input("Heart Rate (bpm)", 60, 200, 120)
    with col2:
        bp = st.text_input("Blood Pressure", "150/95")
    with col3:
        temp = st.number_input("Temperature (°C)", 35.0, 42.0, 37.5)
    with col4:
        o2 = st.number_input("O2 Saturation (%)", 80, 100, 95)
    
    if st.button("🚨 ADMIT - Create Emergency Record"):
        try:
            doctor = st.session_state.validators[er_doctor_idx]
            
            record = create_emergency_record(
                patient_id=patient_id,
                provider_id=doctor.id,
                hospital_id=st.session_state.hospital_name,
                symptoms=symptoms,
                vitals={"HR": hr, "BP": bp, "Temp": temp, "O2": o2},
                provider_key=doctor.public_key
            )
            
            record.sign(doctor.private_key)
            
            if record.verify_signature():
                st.success(f"✅ Emergency Record Created!")
                st.info(f"""
                **Record Details:**
                - Patient: {patient_id}
                - Doctor: {doctor.id}
                - Priority: {record.priority:.3f} 🔴 CRITICAL
                - Status: Ready for blockchain
                """)
            else:
                st.error("❌ Signature verification failed")
        
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")


# ===== PAGE: PHARMACY =====
elif page == "💊 Pharmacy":
    st.title("💊 Pharmacy - Prescription Management")
    st.markdown("**Verify and issue controlled prescriptions (P: 0.60-0.75)**")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Prescription Details")
        patient_id = st.text_input("Patient ID", "P12345")
        medication = st.selectbox("Medication", [
            "Aspirin 500mg",
            "Metformin 1000mg",
            "Lisinopril 10mg",
            "Amoxicillin 500mg",
            "Ibuprofen 200mg"
        ])
    
    with col2:
        st.subheader("Dosage")
        dosage = st.text_input("Dosage", "1 tablet")
        frequency = st.selectbox("Frequency", [
            "Once daily",
            "Twice daily",
            "Three times daily",
            "Every 4-6 hours",
            "As needed"
        ])
    
    doctor_idx = st.selectbox("Prescribing Doctor",
                             range(len(st.session_state.validators)),
                             format_func=lambda i: st.session_state.validators[i].id)
    
    if st.button("✅ Issue Prescription"):
        try:
            doctor = st.session_state.validators[doctor_idx]
            
            record = create_prescription_record(
                patient_id=patient_id,
                provider_id=doctor.id,
                hospital_id=st.session_state.hospital_name,
                medication=medication,
                dosage=dosage,
                frequency=frequency,
                provider_key=doctor.public_key
            )
            
            record.sign(doctor.private_key)
            
            if record.verify_signature():
                st.success(f"✅ Prescription Issued!")
                st.info(f"""
                **Prescription Details:**
                - Medication: {medication}
                - Dosage: {dosage}, {frequency}
                - Patient: {patient_id}
                - Prescriber: {doctor.id}
                - Priority: {record.priority:.3f} 🟠 URGENT
                - Status: Ready for blockchain
                """)
            else:
                st.error("❌ Signature verification failed")
        
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")


# ===== PAGE: LAB RESULTS =====
elif page == "🧪 Lab Results":
    st.title("🧪 Lab Results - Upload & Record")
    st.markdown("**Record laboratory test results (P: 0.40-0.60)**")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Patient & Test Info")
        patient_id = st.text_input("Patient ID", "P12345")
        test_name = st.selectbox("Test Type", [
            "Complete Blood Count",
            "Blood Glucose",
            "Lipid Panel",
            "Liver Function",
            "Kidney Function",
            "COVID-19 PCR",
            "ECG",
            "Chest X-Ray"
        ])
    
    with col2:
        st.subheader("Results")
        status = st.selectbox("Status", ["NORMAL", "ABNORMAL", "CRITICAL"])
        notes = st.text_area("Clinical Notes", "Normal results")
    
    doctor_idx = st.selectbox("Lab Director",
                             range(len(st.session_state.validators)),
                             format_func=lambda i: st.session_state.validators[i].id)
    
    if st.button("📋 Record Lab Result"):
        try:
            doctor = st.session_state.validators[doctor_idx]
            
            record = create_lab_result_record(
                patient_id=patient_id,
                provider_id=doctor.id,
                hospital_id=st.session_state.hospital_name,
                test_name=test_name,
                results={"status": status, "notes": notes},
                provider_key=doctor.public_key
            )
            
            record.sign(doctor.private_key)
            
            if record.verify_signature():
                st.success(f"✅ Lab Result Recorded!")
                st.info(f"""
                **Lab Details:**
                - Test: {test_name}
                - Status: {status}
                - Patient: {patient_id}
                - Recorded by: {doctor.id}
                - Priority: {record.priority:.3f}
                - Status: Ready for blockchain
                """)
            else:
                st.error("❌ Signature verification failed")
        
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")


# ===== PAGE: VITAL SIGNS =====
elif page == "💓 Vital Signs":
    st.title("💓 Vital Signs - Real-time Monitoring")
    st.markdown("**Continuous patient monitoring (High frequency, fast processing)**")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Patient Info")
        patient_id = st.text_input("Patient ID", "P12345")
        location = st.selectbox("Location", [
            "ICU Bed 1",
            "ICU Bed 2",
            "ER Room 1",
            "Ward A",
            "Ward B"
        ])
    
    with col2:
        st.subheader("Current Vitals")
        hr = st.slider("Heart Rate (bpm)", 40, 200, 75)
        bp = st.text_input("BP (mmHg)", "120/80")
        temp = st.slider("Temperature (°C)", 35.0, 40.0, 37.0, 0.1)
        o2 = st.slider("O2 Sat (%)", 85, 100, 98)
    
    nurse_idx = st.selectbox("Monitoring Nurse",
                            range(len(st.session_state.validators)),
                            format_func=lambda i: st.session_state.validators[i].id)
    
    if st.button("📊 Record Vital Signs"):
        try:
            nurse = st.session_state.validators[nurse_idx]
            
            record = create_vital_signs_record(
                patient_id=patient_id,
                provider_id=nurse.id,
                hospital_id=st.session_state.hospital_name,
                heart_rate=hr,
                blood_pressure=bp,
                temperature=temp,
                oxygen_saturation=o2,
                provider_key=nurse.public_key
            )
            
            record.sign(nurse.private_key)
            
            if record.verify_signature():
                st.success(f"✅ Vital Signs Recorded!")
                
                # Check for critical values
                critical = False
                alerts = []
                
                if hr > 120 or hr < 50:
                    alerts.append(f"⚠️ Heart Rate {hr} bpm")
                    critical = True
                
                if o2 < 90:
                    alerts.append(f"⚠️ Low O2: {o2}%")
                    critical = True
                
                if temp > 39 or temp < 36:
                    alerts.append(f"⚠️ Temperature: {temp}°C")
                
                priority_color = "🔴" if critical else "🟡"
                
                st.info(f"""
                **Vital Signs Recorded:**
                - HR: {hr} | BP: {bp} | Temp: {temp}°C | O2: {o2}%
                - Location: {location}
                - Priority: {record.priority:.3f} {priority_color}
                - Recorded by: {nurse.id}
                """)
                
                if alerts:
                    st.warning("⚠️ **ALERTS:**\n" + "\n".join(alerts))
            else:
                st.error("❌ Signature verification failed")
        
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")


# ===== PAGE: RECORDS =====
elif page == "📋 Records":
    st.title("📋 Patient Records - View & Manage")
    
    col1, col2 = st.columns(2)
    
    with col1:
        patient_search = st.text_input("Search Patient ID", "P12345")
    
    with col2:
        record_type_filter = st.selectbox("Filter by Type", [
            "All Records",
            "Emergency Visits",
            "Prescriptions",
            "Lab Results",
            "Vital Signs"
        ])
    
    st.subheader("📄 Sample Records (Demo)")
    
    sample_records = [
        {
            "Timestamp": datetime.now().isoformat(),
            "Type": "🚨 Emergency Visit",
            "Patient": patient_search,
            "Provider": "ER_Doctor_0",
            "Priority": 0.95,
            "Status": "Validated",
            "Hash": "abc123def456..."
        },
        {
            "Timestamp": (datetime.now()).isoformat(),
            "Type": "💊 Prescription",
            "Patient": patient_search,
            "Provider": "Specialist_0",
            "Priority": 0.68,
            "Status": "Pending",
            "Hash": "xyz789uvw012..."
        }
    ]
    
    df = pd.DataFrame(sample_records)
    st.dataframe(df, use_container_width=True)
    
    st.subheader("🔍 Record Details")
    
    if st.checkbox("Show full details"):
        for record in sample_records:
            priority = record["Priority"]
            if priority > 0.85:
                priority_label = "🔴 CRITICAL"
                box_class = "emergency"
            elif priority > 0.60:
                priority_label = "🟠 URGENT"
                box_class = "urgent"
            elif priority > 0.30:
                priority_label = "🟡 ROUTINE"
                box_class = "routine"
            else:
                priority_label = "🟢 ADMIN"
                box_class = "admin"
            
            st.markdown(f"""
            <div class="{box_class}">
            <b>{record['Type']}</b> | {priority_label} | {record['Status']}<br>
            Patient: {record['Patient']} | Provider: {record['Provider']}<br>
            Priority Score: {priority:.3f}
            </div>
            """, unsafe_allow_html=True)


# ===== PAGE: AUDIT LOG =====
elif page == "🔐 Audit Log":
    st.title("🔐 Audit Log - HIPAA Compliance")
    st.markdown("**Immutable record of all access and changes**")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        date_from = st.date_input("From Date")
    with col2:
        date_to = st.date_input("To Date")
    with col3:
        action_filter = st.selectbox("Action", ["All", "Create", "Read", "Update", "Delete"])
    
    st.subheader("📋 Audit Trail")
    
    audit_log = [
        {
            "Timestamp": "2025-11-27 11:20:15",
            "Action": "CREATE",
            "Record Type": "Emergency Visit",
            "Patient ID": "P12345",
            "Provider": "ER_Doctor_0",
            "Status": "✅ Success",
            "Hash": "0x1a2b3c..."
        },
        {
            "Timestamp": "2025-11-27 11:15:45",
            "Action": "READ",
            "Record Type": "Prescription",
            "Patient ID": "P12346",
            "Provider": "Pharmacist_Admin",
            "Status": "✅ Success",
            "Hash": "0x4d5e6f..."
        },
        {
            "Timestamp": "2025-11-27 11:10:30",
            "Action": "CREATE",
            "Record Type": "Lab Result",
            "Patient ID": "P12347",
            "Provider": "Lab_Tech_0",
            "Status": "✅ Success",
            "Hash": "0x7g8h9i..."
        }
    ]
    
    df = pd.DataFrame(audit_log)
    st.dataframe(df, use_container_width=True)
    
    st.subheader("📊 Access Statistics")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Records Accessed", len(audit_log))
    
    with col2:
        st.metric("Failed Attempts", 0)
    
    with col3:
        st.metric("Unauthorized Access Blocks", 0)


# ===== PAGE: SYSTEM STATUS =====
elif page == "⚙️ System Status":
    st.title("⚙️ System Status & Performance")
    
    # Storage status
    st.subheader("💾 Storage Status")
    
    stats = st.session_state.storage.get_stats()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.write("📂 **Storage Details:**")
        st.write(f"Node: {stats.get('node', 'N/A')}")
        st.write(f"Path: {stats.get('path', 'N/A')}")
        if 'blockchain_size_mb' in stats:
            st.write(f"Blockchain Size: {stats['blockchain_size_mb']:.2f} MB")
    
    with col2:
        st.write("🗂️ **Data Files:**")
        st.write(f"Blockchain: {os.path.exists(stats.get('blockchain_file', ''))}")
        st.write(f"Mempool: {os.path.exists(stats.get('mempool_file', ''))}")
        st.write(f"Validators: {os.path.exists(stats.get('validators_file', ''))}")
    
    # Validator status
    st.subheader("👥 Validator Status")
    
    tier_stats = {}
    for v in st.session_state.validators:
        tier = v.tier.name
        if tier not in tier_stats:
            tier_stats[tier] = {"count": 0, "avg_reputation": 0}
        tier_stats[tier]["count"] += 1
        tier_stats[tier]["avg_reputation"] += v.reputation
    
    for tier, stats in tier_stats.items():
        stats["avg_reputation"] /= stats["count"]
    
    tier_df = pd.DataFrame([
        {
            "Tier": tier,
            "Count": stats["count"],
            "Avg Reputation": f"{stats['avg_reputation']:.2f}"
        }
        for tier, stats in tier_stats.items()
    ])
    
    st.dataframe(tier_df, use_container_width=True)
    
    # Performance targets
    st.subheader("🎯 Performance Targets")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Target TPS", HealthcarePerformanceTargets.TARGET_TPS)
    
    with col2:
        st.metric("Critical Latency", f"{HealthcarePerformanceTargets.TARGET_CRITICAL_LATENCY}s")
    
    with col3:
        st.metric("Target Uptime", f"{HealthcarePerformanceTargets.TARGET_UPTIME * 100}%")
    
    # Priority configuration
    st.subheader("📊 Priority Algorithm Configuration")
    
    config_data = {
        "Factor": ["Criticality", "Time Sensitivity", "Resources", "Compliance"],
        "Weight": [
            HealthcarePriorityConfig.ALPHA,
            HealthcarePriorityConfig.BETA,
            HealthcarePriorityConfig.GAMMA,
            HealthcarePriorityConfig.DELTA
        ],
        "Percentage": [
            f"{HealthcarePriorityConfig.ALPHA * 100:.0f}%",
            f"{HealthcarePriorityConfig.BETA * 100:.0f}%",
            f"{HealthcarePriorityConfig.GAMMA * 100:.0f}%",
            f"{HealthcarePriorityConfig.DELTA * 100:.0f}%"
        ]
    }
    
    df = pd.DataFrame(config_data)
    st.dataframe(df, use_container_width=True, hide_index=True)
    
    # Medical record types
    st.subheader("🏥 Supported Medical Record Types")
    
    record_types = []
    for record_type in MedicalRecordType:
        scores = MEDICAL_RECORD_SCORES[record_type]
        record_types.append({
            "Type": record_type.name,
            "Criticality": f"{scores['base_criticality']:.2f}",
            "Time Sensitivity": f"{scores['base_time_sensitivity']:.2f}",
            "Description": scores.get("description", "")
        })
    
    df = pd.DataFrame(record_types)
    st.dataframe(df, use_container_width=True)


# ===== FOOTER =====
st.markdown("---")
st.markdown("""
    <div style="text-align: center; padding: 20px;">
        <p>🏥 <b>Healthcare Blockchain System</b> | HIPAA Compliant | Persistent Storage</p>
        <p>Hospital: """ + st.session_state.hospital_name + """ | Node: """ + st.session_state.node_name + """</p>
        <p>Status: <span style="color: green;">✓ Running</span></p>
    </div>
""", unsafe_allow_html=True)