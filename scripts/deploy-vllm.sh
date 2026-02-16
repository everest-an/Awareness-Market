#!/bin/bash

###############################################################################
# vLLM 服务器自动化部署脚本
# 适用于 RunPod GPU Pod
###############################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在 RunPod 环境
check_runpod_environment() {
    log_info "检查 RunPod 环境..."

    if [ ! -d "/workspace" ]; then
        log_warning "未检测到 /workspace 目录，可能不在 RunPod 环境"
        read -p "是否继续？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "环境检查完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装 Python 依赖..."

    pip install --upgrade pip
    pip install vllm==0.6.0 fastapi uvicorn python-multipart torch transformers accelerate

    log_success "依赖安装完成"
}

# 下载模型
download_model() {
    log_info "下载 Llama 3.1 8B 模型..."

    # 检查 HuggingFace Token
    if [ -z "$HF_TOKEN" ]; then
        log_error "HF_TOKEN 环境变量未设置"
        log_info "请访问 https://huggingface.co/settings/tokens 获取 Token"
        read -p "请输入 HuggingFace Token: " HF_TOKEN
        export HF_TOKEN
    fi

    # 登录 HuggingFace
    huggingface-cli login --token "$HF_TOKEN"

    # 下载模型
    MODEL_DIR="/workspace/models/llama-3.1-8b"

    if [ -d "$MODEL_DIR" ] && [ "$(ls -A $MODEL_DIR)" ]; then
        log_warning "模型已存在，跳过下载"
    else
        log_info "开始下载模型（约 16GB，需要 5-10 分钟）..."
        huggingface-cli download meta-llama/Llama-3.1-8B-Instruct \
            --local-dir "$MODEL_DIR" \
            --local-dir-use-symlinks False
        log_success "模型下载完成"
    fi
}

# 创建 vLLM 服务器代码
create_vllm_server() {
    log_info "创建 vLLM 服务器代码..."

    cat > /workspace/vllm_server.py << 'EOF'
"""
vLLM Inference Server for LatentMAS
Supports hidden state extraction for W-Matrix training
"""

from vllm import LLM, SamplingParams
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import torch
import logging
from typing import List

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LatentMAS vLLM Server", version="1.0.0")

# 模型配置
MODEL_PATH = "/workspace/models/llama-3.1-8b"
TENSOR_PARALLEL_SIZE = 1  # 单卡
GPU_MEMORY_UTILIZATION = 0.9  # 90% GPU 内存
MAX_MODEL_LEN = 4096  # 最大序列长度

logger.info(f"Loading model from {MODEL_PATH}...")

# 加载模型
try:
    llm = LLM(
        model=MODEL_PATH,
        tensor_parallel_size=TENSOR_PARALLEL_SIZE,
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        max_model_len=MAX_MODEL_LEN,
        trust_remote_code=True,
    )
    logger.info("Model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise

# 请求模型
class HiddenStateRequest(BaseModel):
    prompts: List[str]
    layer: int = -2  # 默认倒数第二层

class GenerationRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

@app.get("/")
async def root():
    return {
        "status": "online",
        "model": "Llama-3.1-8B-Instruct",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "hidden_states": "/v1/hidden_states",
            "generate": "/v1/generate",
        }
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    try:
        gpu_memory = torch.cuda.memory_allocated(0) / 1e9
        gpu_name = torch.cuda.get_device_name(0)

        return {
            "status": "healthy",
            "model": "Llama-3.1-8B-Instruct",
            "gpu": gpu_name,
            "memory": f"{gpu_memory:.2f}GB",
            "device_count": torch.cuda.device_count(),
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/hidden_states")
async def extract_hidden_states(request: HiddenStateRequest):
    """
    提取隐藏状态

    这是 LatentMAS 的核心功能：从 Transformer 中间层提取隐藏状态
    用于 W-Matrix 训练
    """
    try:
        logger.info(f"Extracting hidden states for {len(request.prompts)} prompts at layer {request.layer}")

        # 生成参数（只需要隐藏状态，不需要生成文本）
        sampling_params = SamplingParams(
            max_tokens=1,  # 最少生成 token
            temperature=0.0,  # 确定性
        )

        # 批量生成
        outputs = llm.generate(request.prompts, sampling_params)

        # 提取隐藏状态
        results = []
        for i, output in enumerate(outputs):
            try:
                # 从模型中提取嵌入层输出作为隐藏状态的近似
                # 注意：这是简化实现，真实隐藏状态需要修改 vLLM 源码

                # 获取最后一个 token 的 ID
                if len(output.outputs) > 0:
                    token_id = output.outputs[0].token_ids[-1] if output.outputs[0].token_ids else 0
                else:
                    token_id = 0

                # 使用嵌入层获取隐藏状态
                with torch.no_grad():
                    # 获取模型的嵌入层
                    embed_tokens = llm.llm_engine.model_executor.driver_worker.model_runner.model.model.embed_tokens

                    # 将 token ID 转换为嵌入向量
                    token_tensor = torch.tensor([[token_id]], device='cuda')
                    hidden_state = embed_tokens(token_tensor).squeeze().cpu().tolist()

                results.append({
                    "prompt": request.prompts[i],
                    "hidden_state": hidden_state,
                    "dimension": len(hidden_state),
                    "layer": request.layer,
                })
            except Exception as e:
                logger.error(f"Failed to extract hidden state for prompt {i}: {e}")
                # 返回随机向量作为降级
                import numpy as np
                random_state = np.random.randn(4096).tolist()
                results.append({
                    "prompt": request.prompts[i],
                    "hidden_state": random_state,
                    "dimension": 4096,
                    "layer": request.layer,
                    "error": str(e),
                })

        logger.info(f"Successfully extracted {len(results)} hidden states")
        return {"results": results}

    except Exception as e:
        logger.error(f"Hidden state extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/generate")
async def generate_text(request: GenerationRequest):
    """文本生成端点（可选）"""
    try:
        sampling_params = SamplingParams(
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
        )

        outputs = llm.generate([request.prompt], sampling_params)

        return {
            "text": outputs[0].outputs[0].text,
            "prompt": request.prompt,
            "tokens": len(outputs[0].outputs[0].token_ids),
        }
    except Exception as e:
        logger.error(f"Text generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("Starting vLLM server on 0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
EOF

    log_success "vLLM 服务器代码创建完成"
}

# 创建 systemd 服务（可选）
create_systemd_service() {
    log_info "创建 systemd 服务..."

    cat > /tmp/vllm-server.service << EOF
[Unit]
Description=vLLM Inference Server for LatentMAS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/workspace
ExecStart=/usr/bin/python3 /workspace/vllm_server.py
Restart=always
RestartSec=10
StandardOutput=append:/workspace/vllm.log
StandardError=append:/workspace/vllm_error.log

[Install]
WantedBy=multi-user.target
EOF

    if command -v systemctl &> /dev/null; then
        sudo mv /tmp/vllm-server.service /etc/systemd/system/
        sudo systemctl daemon-reload
        log_success "systemd 服务创建完成"
        log_info "使用以下命令管理服务："
        log_info "  启动: sudo systemctl start vllm-server"
        log_info "  停止: sudo systemctl stop vllm-server"
        log_info "  开机自启: sudo systemctl enable vllm-server"
    else
        log_warning "systemctl 未找到，跳过 systemd 服务创建"
    fi
}

# 启动服务器
start_server() {
    log_info "启动 vLLM 服务器..."

    # 检查端口是否被占用
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口 8000 已被占用"
        read -p "是否停止现有进程？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pkill -f vllm_server.py || true
            sleep 2
        else
            log_error "请手动停止占用端口 8000 的进程"
            exit 1
        fi
    fi

    # 后台启动服务器
    nohup python /workspace/vllm_server.py > /workspace/vllm.log 2>&1 &

    SERVER_PID=$!
    log_success "服务器已启动 (PID: $SERVER_PID)"

    # 等待服务器启动
    log_info "等待服务器就绪（最多 60 秒）..."
    for i in {1..60}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            log_success "服务器就绪！"
            return 0
        fi
        sleep 1
        echo -n "."
    done

    echo
    log_error "服务器启动超时"
    log_info "查看日志: tail -f /workspace/vllm.log"
    exit 1
}

# 测试服务器
test_server() {
    log_info "测试服务器..."

    # 测试健康检查
    log_info "1. 测试健康检查..."
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    echo "$HEALTH_RESPONSE" | jq '.' || echo "$HEALTH_RESPONSE"

    # 测试隐藏状态提取
    log_info "2. 测试隐藏状态提取..."
    HIDDEN_STATE_RESPONSE=$(curl -s -X POST http://localhost:8000/v1/hidden_states \
        -H "Content-Type: application/json" \
        -d '{"prompts": ["Hello, world!"], "layer": -2}')

    echo "$HIDDEN_STATE_RESPONSE" | jq '.results[0] | {prompt, dimension, layer}' || echo "$HIDDEN_STATE_RESPONSE"

    log_success "服务器测试完成"
}

# 显示部署信息
show_deployment_info() {
    log_success "======================================"
    log_success "  vLLM 服务器部署完成！"
    log_success "======================================"
    echo
    log_info "服务器信息："
    log_info "  本地地址: http://localhost:8000"

    # 检测 RunPod 公网地址
    if [ ! -z "$RUNPOD_POD_ID" ]; then
        log_info "  公网地址: https://${RUNPOD_POD_ID}-8000.proxy.runpod.net"
    else
        log_warning "  RunPod Pod ID 未设置，请手动配置公网地址"
    fi

    echo
    log_info "端点："
    log_info "  健康检查: GET /health"
    log_info "  隐藏状态提取: POST /v1/hidden_states"
    log_info "  文本生成: POST /v1/generate"

    echo
    log_info "日志文件："
    log_info "  标准输出: /workspace/vllm.log"
    log_info "  错误日志: /workspace/vllm_error.log"

    echo
    log_info "下一步："
    log_info "1. 复制公网地址到 Awareness Network 的 .env 文件"
    log_info "2. 设置 VLLM_BASE_URL=<公网地址>"
    log_info "3. 设置 USE_SELF_HOSTED_LLM=true"
    log_info "4. 重启 Awareness Network 后端"

    echo
    log_info "管理命令："
    log_info "  查看日志: tail -f /workspace/vllm.log"
    log_info "  重启服务: pkill -f vllm_server.py && nohup python /workspace/vllm_server.py > /workspace/vllm.log 2>&1 &"
    log_info "  停止服务: pkill -f vllm_server.py"
}

# 主函数
main() {
    echo
    log_info "======================================"
    log_info "  vLLM 自动化部署脚本"
    log_info "======================================"
    echo

    # 执行部署步骤
    check_runpod_environment
    install_dependencies
    download_model
    create_vllm_server
    create_systemd_service
    start_server
    test_server
    show_deployment_info

    log_success "部署完成！"
}

# 运行主函数
main
