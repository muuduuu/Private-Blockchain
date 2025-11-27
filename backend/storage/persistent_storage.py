
import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import shutil
from datetime import datetime
from backend.healthcare_config import StorageConfig
import threading


class PersistentBlockchainStorage:
    """
    Real file-based storage for blockchain data.
    Each node has its own directory with blockchain state.
    """
    
    def __init__(self, hospital_name: str = "Hospital_A", node_name: str = "Node_1"):
        """Initialize persistent storage for a specific node"""
        self.hospital_name = hospital_name
        self.node_name = node_name
        
        # Setup paths
        self.hospital_path = os.path.join(StorageConfig.DB_PATH, hospital_name)
        self.node_path = os.path.join(self.hospital_path, node_name)
        
        # Create directories
        os.makedirs(self.node_path, exist_ok=True)
        
        # Lock for thread-safe writes
        self.lock = threading.RLock()
        
        print(f"🏥 Storage initialized for {hospital_name}/{node_name}")
        print(f"   Path: {self.node_path}")
    
    def save_blockchain(self, blocks: List[Dict[str, Any]]) -> bool:
        """Save entire blockchain to disk"""
        try:
            with self.lock:
                chain_file = os.path.join(self.node_path, "blockchain.json")
                
                chain_data = {
                    "hospital": self.hospital_name,
                    "node": self.node_name,
                    "saved_at": datetime.now().isoformat(),
                    "block_count": len(blocks),
                    "blocks": blocks
                }
                
                # Write atomically (write to temp, then rename)
                temp_file = chain_file + ".tmp"
                with open(temp_file, 'w') as f:
                    json.dump(chain_data, f, indent=2)
                
                shutil.move(temp_file, chain_file)
                
                print(f"✓ Saved {len(blocks)} blocks")
                return True
        
        except Exception as e:
            print(f"✗ Error saving blockchain: {e}")
            return False
    
    def load_blockchain(self) -> Optional[List[Dict[str, Any]]]:
        """Load blockchain from disk"""
        try:
            with self.lock:
                chain_file = os.path.join(self.node_path, "blockchain.json")
                
                if not os.path.exists(chain_file):
                    print(f"⚠ No blockchain found at {chain_file}")
                    return None
                
                with open(chain_file, 'r') as f:
                    chain_data = json.load(f)
                
                blocks = chain_data.get("blocks", [])
                print(f"✓ Loaded {len(blocks)} blocks from disk")
                return blocks
        
        except Exception as e:
            print(f"✗ Error loading blockchain: {e}")
            return None
    
    def save_mempool(self, transactions: List[Dict[str, Any]]) -> bool:
        """Save mempool (pending transactions) to disk"""
        try:
            with self.lock:
                mempool_file = os.path.join(self.node_path, "mempool.json")
                
                mempool_data = {
                    "saved_at": datetime.now().isoformat(),
                    "tx_count": len(transactions),
                    "transactions": transactions
                }
                
                with open(mempool_file, 'w') as f:
                    json.dump(mempool_data, f, indent=2)
                
                return True
        
        except Exception as e:
            print(f"✗ Error saving mempool: {e}")
            return False
    
    def load_mempool(self) -> Optional[List[Dict[str, Any]]]:
        """Load mempool from disk"""
        try:
            with self.lock:
                mempool_file = os.path.join(self.node_path, "mempool.json")
                
                if not os.path.exists(mempool_file):
                    return []
                
                with open(mempool_file, 'r') as f:
                    mempool_data = json.load(f)
                
                return mempool_data.get("transactions", [])
        
        except Exception as e:
            print(f"✗ Error loading mempool: {e}")
            return []
    
    def save_validators(self, validators: List[Dict[str, Any]]) -> bool:
        """Save validator states"""
        try:
            with self.lock:
                validators_file = os.path.join(self.node_path, "validators.json")
                
                validators_data = {
                    "saved_at": datetime.now().isoformat(),
                    "validator_count": len(validators),
                    "validators": validators
                }
                
                with open(validators_file, 'w') as f:
                    json.dump(validators_data, f, indent=2)
                
                return True
        
        except Exception as e:
            print(f"✗ Error saving validators: {e}")
            return False
    
    def load_validators(self) -> Optional[List[Dict[str, Any]]]:
        """Load validator states"""
        try:
            with self.lock:
                validators_file = os.path.join(self.node_path, "validators.json")
                
                if not os.path.exists(validators_file):
                    return None
                
                with open(validators_file, 'r') as f:
                    validators_data = json.load(f)
                
                return validators_data.get("validators", [])
        
        except Exception as e:
            print(f"✗ Error loading validators: {e}")
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            chain_file = os.path.join(self.node_path, "blockchain.json")
            mempool_file = os.path.join(self.node_path, "mempool.json")
            validators_file = os.path.join(self.node_path, "validators.json")
            
            stats = {
                "node": f"{self.hospital_name}/{self.node_name}",
                "path": self.node_path,
                "blockchain_file": chain_file,
                "mempool_file": mempool_file,
                "validators_file": validators_file
            }
            
            # File sizes
            if os.path.exists(chain_file):
                stats["blockchain_size_mb"] = os.path.getsize(chain_file) / (1024 * 1024)
            
            if os.path.exists(mempool_file):
                stats["mempool_size_kb"] = os.path.getsize(mempool_file) / 1024
            
            return stats
        
        except Exception as e:
            print(f"✗ Error getting stats: {e}")
            return {}
    
    def clear_data(self) -> bool:
        """DANGER: Clear all data for this node"""
        try:
            with self.lock:
                if os.path.exists(self.node_path):
                    shutil.rmtree(self.node_path)
                    os.makedirs(self.node_path, exist_ok=True)
                    print(f"✓ Cleared all data for {self.node_name}")
                    return True
        
        except Exception as e:
            print(f"✗ Error clearing data: {e}")
            return False
    
    def backup(self) -> Optional[str]:
        """Create timestamped backup"""
        try:
            with self.lock:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = os.path.join(self.hospital_path, f"backup_{timestamp}")
                
                shutil.copytree(self.node_path, backup_path)
                
                print(f"✓ Backup created: {backup_path}")
                return backup_path
        
        except Exception as e:
            print(f"✗ Error creating backup: {e}")
            return None


class MultiHospitalStorage:
    """
    Manage storage for multiple hospitals running on same machine
    Each hospital is isolated in its own directory
    """
    
    def __init__(self, base_path: str = "./healthcare_blockchain_data"):
        """Initialize multi-hospital storage"""
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
    
    def get_hospital_storage(self, hospital_name: str, node_name: str) -> PersistentBlockchainStorage:
        """Get storage instance for a specific hospital node"""
        return PersistentBlockchainStorage(hospital_name, node_name)
    
    def list_hospitals(self) -> List[str]:
        """List all hospitals with data"""
        hospitals = []
        for item in os.listdir(self.base_path):
            item_path = os.path.join(self.base_path, item)
            if os.path.isdir(item_path):
                hospitals.append(item)
        return hospitals
    
    def list_nodes(self, hospital_name: str) -> List[str]:
        """List all nodes for a hospital"""
        nodes = []
        hospital_path = os.path.join(self.base_path, hospital_name)
        
        if os.path.exists(hospital_path):
            for item in os.listdir(hospital_path):
                item_path = os.path.join(hospital_path, item)
                if os.path.isdir(item_path) and item.startswith("Node"):
                    nodes.append(item)
        
        return nodes
    
    def get_network_stats(self) -> Dict[str, Any]:
        """Get stats across entire network"""
        hospitals = self.list_hospitals()
        
        stats = {
            "total_hospitals": len(hospitals),
            "hospitals": {}
        }
        
        for hospital in hospitals:
            nodes = self.list_nodes(hospital)
            stats["hospitals"][hospital] = {
                "total_nodes": len(nodes),
                "nodes": nodes
            }
        
        return stats


if __name__ == "__main__":
    # Test persistent storage
    print("=" * 80)
    print("Testing Persistent Blockchain Storage")
    print("=" * 80)
    
    # Create storage for Hospital A, Node 1
    storage = PersistentBlockchainStorage("Hospital_A", "Node_1")
    
    # Save test data
    test_blocks = [
        {
            "index": 0,
            "hash": "genesis",
            "transactions": []
        },
        {
            "index": 1,
            "hash": "block1",
            "transactions": [{"id": "tx1", "type": "EMERGENCY"}]
        }
    ]
    
    storage.save_blockchain(test_blocks)
    
    # Load and verify
    loaded = storage.load_blockchain()
    print(f"Loaded {len(loaded)} blocks")
    
    # Stats
    print("\nStorage Stats:")
    for k, v in storage.get_stats().items():
        print(f"  {k}: {v}")