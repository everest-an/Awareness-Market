"""
Golem Vector Space Backend
可视化工具的后端 Python 模块

功能：
- 向量处理和规范化
- 高维向量投影到 3D
- API 端点
"""

import numpy as np
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import json


@dataclass
class Vector:
    """向量数据类"""
    id: str
    vector: List[float]
    label: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class GolemBackend:
    """Golem 可视化工具后端处理类"""

    def __init__(self, use_pca: bool = True, n_components: int = 3):
        """
        初始化后端

        Args:
            use_pca: 是否使用 PCA 降维
            n_components: 目标维度（默认 3D）
        """
        self.use_pca = use_pca
        self.n_components = n_components
        self.pca = None
        self.scaler = StandardScaler()
        self.vectors: List[Vector] = []

    def add_vectors(self, vectors: List[Dict[str, Any]]) -> None:
        """
        添加向量到可视化集合

        Args:
            vectors: 向量列表，每个项包含 id, vector, label, metadata
        """
        for v in vectors:
            self.vectors.append(
                Vector(
                    id=v['id'],
                    vector=v['vector'],
                    label=v.get('label'),
                    metadata=v.get('metadata'),
                )
            )

    def project_to_3d(self) -> List[Dict[str, Any]]:
        """
        将向量投影到 3D 空间

        Returns:
            投影后的向量列表
        """
        if not self.vectors:
            return []

        # 转换为 numpy 数组
        vectors_array = np.array([v.vector for v in self.vectors])

        # 标准化
        vectors_normalized = self.scaler.fit_transform(vectors_array)

        # PCA 降维
        if self.use_pca:
            self.pca = PCA(n_components=min(self.n_components, vectors_normalized.shape[1]))
            vectors_3d = self.pca.fit_transform(vectors_normalized)
        else:
            # 简单裁剪到 3D
            vectors_3d = vectors_normalized[:, : self.n_components]
            if vectors_3d.shape[1] < self.n_components:
                padding = np.zeros(
                    (vectors_3d.shape[0], self.n_components - vectors_3d.shape[1])
                )
                vectors_3d = np.hstack([vectors_3d, padding])

        # 构建结果
        results = []
        for i, vector_obj in enumerate(self.vectors):
            results.append(
                {
                    'id': vector_obj.id,
                    'vector': vectors_3d[i].tolist(),
                    'label': vector_obj.label,
                    'metadata': vector_obj.metadata or {},
                }
            )

        return results

    def get_statistics(self) -> Dict[str, Any]:
        """获取向量集合的统计信息"""
        if not self.vectors:
            return {}

        vectors_array = np.array([v.vector for v in self.vectors])

        return {
            'total_vectors': len(self.vectors),
            'original_dimension': vectors_array.shape[1],
            'target_dimension': self.n_components,
            'mean': vectors_array.mean(axis=0).tolist(),
            'std': vectors_array.std(axis=0).tolist(),
            'min': vectors_array.min(axis=0).tolist(),
            'max': vectors_array.max(axis=0).tolist(),
        }

    def find_similar(self, query_id: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        查找相似向量（KNN）

        Args:
            query_id: 查询向量 ID
            k: 返回最相似的 k 个向量

        Returns:
            相似向量列表（按距离排序）
        """
        if not self.vectors:
            return []

        # 找到查询向量
        query_vector = None
        query_index = -1
        for i, v in enumerate(self.vectors):
            if v.id == query_id:
                query_vector = np.array(v.vector)
                query_index = i
                break

        if query_vector is None:
            return []

        # 计算距离
        vectors_array = np.array([v.vector for v in self.vectors])
        distances = np.linalg.norm(vectors_array - query_vector, axis=1)

        # 获取最近的 k 个
        nearest_indices = np.argsort(distances)[1 : k + 1]  # 跳过第一个（自己）

        results = []
        for idx in nearest_indices:
            results.append(
                {
                    'id': self.vectors[idx].id,
                    'distance': distances[idx].item(),
                    'label': self.vectors[idx].label,
                    'metadata': self.vectors[idx].metadata,
                }
            )

        return results

    def export_json(self, filepath: str) -> None:
        """导出投影数据为 JSON"""
        data = self.project_to_3d()
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def import_json(self, filepath: str) -> None:
        """从 JSON 导入数据"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        self.add_vectors(data)


# Flask 集成示例
def create_flask_app(backend: Optional[GolemBackend] = None):
    """
    创建 Flask 应用，用于提供 API 接口

    Args:
        backend: GolemBackend 实例

    Returns:
        Flask 应用对象
    """
    try:
        from flask import Flask, request, jsonify
    except ImportError:
        print("Flask 未安装，请运行: pip install flask")
        return None

    app = Flask(__name__)
    if backend is None:
        backend = GolemBackend()

    @app.route('/api/vectors', methods=['GET'])
    def get_vectors():
        """获取投影后的向量"""
        return jsonify(backend.project_to_3d())

    @app.route('/api/vectors', methods=['POST'])
    def add_vectors():
        """添加向量"""
        data = request.json
        backend.add_vectors(data)
        return jsonify({'status': 'success', 'count': len(backend.vectors)})

    @app.route('/api/statistics', methods=['GET'])
    def get_stats():
        """获取统计信息"""
        return jsonify(backend.get_statistics())

    @app.route('/api/similar/<query_id>', methods=['GET'])
    def find_similar(query_id):
        """查找相似向量"""
        k = request.args.get('k', 5, type=int)
        results = backend.find_similar(query_id, k)
        return jsonify(results)

    @app.route('/api/health', methods=['GET'])
    def health():
        """健康检查"""
        return jsonify({'status': 'healthy', 'vectors_count': len(backend.vectors)})

    return app


if __name__ == '__main__':
    # 示例使用
    backend = GolemBackend()

    # 添加示例向量
    sample_vectors = [
        {
            'id': 'v1',
            'vector': [1.0, 2.0, 3.0, 4.0],
            'label': 'Vector 1',
        },
        {
            'id': 'v2',
            'vector': [1.1, 2.1, 3.1, 4.1],
            'label': 'Vector 2',
        },
        {
            'id': 'v3',
            'vector': [5.0, 6.0, 7.0, 8.0],
            'label': 'Vector 3',
        },
    ]

    backend.add_vectors(sample_vectors)

    # 投影到 3D
    projected = backend.project_to_3d()
    print("投影结果:", json.dumps(projected, indent=2))

    # 统计信息
    stats = backend.get_statistics()
    print("统计信息:", json.dumps(stats, indent=2))

    # 查找相似向量
    similar = backend.find_similar('v1', k=2)
    print("相似向量:", json.dumps(similar, indent=2))
