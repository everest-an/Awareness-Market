"""
Project Golem - 可集成的Python后端模块
用于与其他项目集成的向量查询服务

使用方法:
    from golem_backend import GolemBackend
    
    backend = GolemBackend(
        model_id="google/embedding-gemma-300m",
        vector_file="golem_vectors.npy",
        json_file="golem_cortex.json"
    )
    
    results = backend.query("Julius Caesar")
    print(results)  # {'indices': [...], 'scores': [...]}
"""

import os
import json
import numpy as np
import torch
from typing import Dict, List, Tuple
from sentence_transformers import SentenceTransformer


class GolemBackend:
    """
    Project Golem 后端查询服务类
    
    属性:
        model_id (str): 向量化模型ID
        device (str): 计算设备 ('cpu', 'cuda', 'mps')
        memory_matrix (np.ndarray): 向量矩阵
        cortex_data (list): 节点数据
        model (SentenceTransformer): 向量化模型实例
    """
    
    def __init__(self, 
                 model_id: str = "google/embedding-gemma-300m",
                 vector_file: str = "golem_vectors.npy",
                 json_file: str = "golem_cortex.json",
                 device: str = None,
                 trust_remote_code: bool = True):
        """
        初始化GolemBackend
        
        参数:
            model_id: 向量化模型ID (默认: google/embedding-gemma-300m)
            vector_file: 向量矩阵文件路径
            json_file: 节点数据JSON文件路径
            device: 计算设备('cpu', 'cuda', 'mps', 自动检测)
            trust_remote_code: 是否信任远程代码
        """
        
        self.model_id = model_id
        self.vector_file = vector_file
        self.json_file = json_file
        self.trust_remote_code = trust_remote_code
        
        # 自动检测设备
        if device is None:
            self.device = self._detect_device()
        else:
            self.device = device
        
        print(f"🧠 GolemBackend Initialization")
        print(f"   📊 Model: {model_id}")
        print(f"   💻 Device: {self.device.upper()}")
        
        # 加载数据
        self.memory_matrix = None
        self.cortex_data = None
        self.model = None
        
        self._load_resources()
    
    @staticmethod
    def _detect_device() -> str:
        """自动检测可用的计算设备"""
        if torch.cuda.is_available():
            return "cuda"
        elif torch.backends.mps.is_available():
            return "mps"
        else:
            return "cpu"
    
    def _load_resources(self):
        """加载向量矩阵、节点数据和模型"""
        
        # 检查文件存在
        if not os.path.exists(self.vector_file):
            raise FileNotFoundError(f"Vector file not found: {self.vector_file}")
        if not os.path.exists(self.json_file):
            raise FileNotFoundError(f"JSON file not found: {self.json_file}")
        
        # 加载向量矩阵
        print(f"   ↳ Loading memory matrix from {self.vector_file}...")
        self.memory_matrix = np.load(self.vector_file)
        
        # 规范化向量矩阵
        norm = np.linalg.norm(self.memory_matrix, axis=1, keepdims=True)
        self.memory_matrix = self.memory_matrix / norm
        print(f"      ✓ Shape: {self.memory_matrix.shape}")
        
        # 加载节点数据
        print(f"   ↳ Loading cortex data from {self.json_file}...")
        with open(self.json_file, 'r') as f:
            self.cortex_data = json.load(f)
        print(f"      ✓ Nodes: {len(self.cortex_data)}")
        
        # 加载模型
        print(f"   ↳ Loading model {self.model_id}...")
        self.model = SentenceTransformer(
            self.model_id,
            device=self.device,
            trust_remote_code=self.trust_remote_code
        )
        print(f"      ✓ Model loaded successfully")
        print(f"   ✅ GolemBackend ready\n")
    
    def query(self, 
              text: str, 
              top_k: int = 50,
              min_score: float = None) -> Dict[str, List]:
        """
        查询向量数据库
        
        参数:
            text: 查询文本
            top_k: 返回的前K个结果数量 (默认: 50)
            min_score: 最小相似度阈值 (可选)
        
        返回:
            {
                'indices': [节点索引列表],
                'scores': [相似度分数列表],
                'nodes': [完整节点数据列表]
            }
        """
        
        if not text or not text.strip():
            return {'indices': [], 'scores': [], 'nodes': []}
        
        # 向量化查询文本
        query_vec = self.model.encode(
            [f"Represent this query for retrieval: {text}"],
            convert_to_numpy=True
        )[0]
        
        # 余弦相似度计算
        scores = np.dot(self.memory_matrix, query_vec)
        
        # 获取前K个结果
        top_indices = np.argsort(scores)[-top_k:][::-1]
        top_scores = scores[top_indices]
        
        # 可选的阈值过滤
        if min_score is not None:
            mask = top_scores >= min_score
            top_indices = top_indices[mask]
            top_scores = top_scores[mask]
        
        # 获取完整节点数据
        nodes = [self.cortex_data[idx] for idx in top_indices]
        
        return {
            'indices': top_indices.tolist(),
            'scores': top_scores.tolist(),
            'nodes': nodes
        }
    
    def query_advanced(self,
                      text: str,
                      top_k: int = 50,
                      category_filter: str = None,
                      min_score: float = None) -> Dict:
        """
        高级查询函数，支持分类过滤
        
        参数:
            text: 查询文本
            top_k: 返回的前K个结果
            category_filter: 按分类过滤 (None表示不过滤)
            min_score: 最小相似度
        
        返回:
            包含过滤后结果的字典
        """
        
        result = self.query(text, top_k=top_k*2, min_score=min_score)
        
        # 分类过滤
        if category_filter:
            filtered_indices = []
            filtered_scores = []
            filtered_nodes = []
            
            for idx, score, node in zip(result['indices'], result['scores'], result['nodes']):
                if node.get('cat') == category_filter:
                    filtered_indices.append(idx)
                    filtered_scores.append(score)
                    filtered_nodes.append(node)
                
                if len(filtered_indices) >= top_k:
                    break
            
            result = {
                'indices': filtered_indices,
                'scores': filtered_scores,
                'nodes': filtered_nodes
            }
        else:
            # 仅保留前K个
            result = {
                'indices': result['indices'][:top_k],
                'scores': result['scores'][:top_k],
                'nodes': result['nodes'][:top_k]
            }
        
        return result
    
    def batch_query(self, 
                   texts: List[str], 
                   top_k: int = 10) -> List[Dict]:
        """
        批量查询
        
        参数:
            texts: 查询文本列表
            top_k: 每个查询返回的结果数
        
        返回:
            查询结果列表
        """
        
        return [self.query(text, top_k=top_k) for text in texts]
    
    def get_node(self, index: int) -> Dict:
        """获取指定索引的节点数据"""
        if 0 <= index < len(self.cortex_data):
            return self.cortex_data[index]
        return None
    
    def get_all_nodes(self) -> List[Dict]:
        """获取所有节点数据"""
        return self.cortex_data
    
    def get_nodes_by_category(self, category: str) -> List[Dict]:
        """获取指定分类的所有节点"""
        return [node for node in self.cortex_data if node.get('cat') == category]
    
    def get_categories(self) -> List[str]:
        """获取所有分类"""
        categories = set()
        for node in self.cortex_data:
            if 'cat' in node:
                categories.add(node['cat'])
        return sorted(list(categories))
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        categories = {}
        for node in self.cortex_data:
            cat = node.get('cat', 'Unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        return {
            'total_nodes': len(self.cortex_data),
            'categories': categories,
            'vector_dimension': self.memory_matrix.shape[1],
            'model_id': self.model_id,
            'device': self.device
        }
    
    def search_by_title(self, title_query: str) -> List[Dict]:
        """按标题搜索节点"""
        results = []
        query_lower = title_query.lower()
        
        for node in self.cortex_data:
            if query_lower in node.get('title', '').lower():
                results.append(node)
        
        return results
    
    def get_neighbors(self, node_index: int, k: int = 8) -> List[Dict]:
        """获取节点的邻居"""
        node = self.get_node(node_index)
        if not node:
            return []
        
        neighbor_indices = node.get('nbs', [])[:k]
        return [self.get_node(idx) for idx in neighbor_indices if self.get_node(idx)]


# ==================== Flask集成示例 ====================

def create_flask_app(backend: GolemBackend):
    """
    创建Flask应用，集成GolemBackend
    
    使用方法:
        backend = GolemBackend()
        app = create_flask_app(backend)
        app.run(port=8000)
    """
    from flask import Flask, request, jsonify
    
    app = Flask(__name__)
    
    @app.route('/query', methods=['POST'])
    def query_endpoint():
        """查询端点"""
        try:
            data = request.json
            query_text = data.get('query', '')
            top_k = data.get('top_k', 50)
            min_score = data.get('min_score', None)
            
            result = backend.query(query_text, top_k=top_k, min_score=min_score)
            
            return jsonify({
                'success': True,
                'indices': result['indices'],
                'scores': result['scores']
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400
    
    @app.route('/query/advanced', methods=['POST'])
    def query_advanced_endpoint():
        """高级查询端点"""
        try:
            data = request.json
            result = backend.query_advanced(
                text=data.get('query', ''),
                top_k=data.get('top_k', 50),
                category_filter=data.get('category', None),
                min_score=data.get('min_score', None)
            )
            
            return jsonify({
                'success': True,
                'indices': result['indices'],
                'scores': result['scores'],
                'nodes': result['nodes']
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400
    
    @app.route('/node/<int:index>', methods=['GET'])
    def get_node_endpoint(index):
        """获取节点信息"""
        node = backend.get_node(index)
        if node:
            return jsonify({'success': True, 'node': node})
        return jsonify({'success': False, 'error': 'Node not found'}), 404
    
    @app.route('/categories', methods=['GET'])
    def get_categories_endpoint():
        """获取所有分类"""
        return jsonify({
            'success': True,
            'categories': backend.get_categories()
        })
    
    @app.route('/statistics', methods=['GET'])
    def get_statistics_endpoint():
        """获取统计信息"""
        return jsonify({
            'success': True,
            'statistics': backend.get_statistics()
        })
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """健康检查"""
        return jsonify({
            'success': True,
            'status': 'healthy',
            'nodes': len(backend.cortex_data)
        })
    
    return app


# ==================== 使用示例 ====================

if __name__ == "__main__":
    # 初始化后端
    backend = GolemBackend(
        model_id="google/embedding-gemma-300m",
        vector_file="golem_vectors.npy",
        json_file="golem_cortex.json"
    )
    
    # 示例1: 简单查询
    print("📊 查询示例:")
    result = backend.query("Julius Caesar", top_k=5)
    print(f"   找到 {len(result['indices'])} 个结果")
    for i, node in enumerate(result['nodes'][:3]):
        print(f"   {i+1}. {node['title']} ({node['cat']}) - 相似度: {result['scores'][i]:.4f}")
    
    # 示例2: 分类过滤
    print("\n📂 按分类过滤:")
    categories = backend.get_categories()
    print(f"   可用分类: {', '.join(categories)}")
    
    # 示例3: 统计信息
    print("\n📈 统计信息:")
    stats = backend.get_statistics()
    for cat, count in stats['categories'].items():
        print(f"   {cat}: {count}")
    
    # 示例4: 启动Flask应用
    print("\n🚀 启动Flask应用...")
    app = create_flask_app(backend)
    app.run(port=8000, debug=False)
