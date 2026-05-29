from fastapi import FastAPI, File, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
import time
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI(
    title="OcularAI Engine Node - Stage 2",
    description="Advanced medical vision computing node with OpenCV pipeline.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# === 核心算法：医学级眼底彩照增强流水线 ===
def process_fundus_pipeline(image_bytes: bytes) -> str:
    """
    底层的硬核影像处理逻辑：
    Bytes -> PIL -> OpenCV -> Green Channel -> CLAHE -> Base64 String
    """
    # 1. 将前端传来的二进制流还原为 OpenCV 矩阵 (BGR 格式)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 2. 强制规范化尺寸为 1024x1024（对齐未来 AI 模型的输入特征维度）
    img_resized = cv2.resize(img_bgr, (1024, 1024), interpolation=cv2.INTER_AREA)
    
    # 3. 提取绿色通道 (OpenCV 默认是 BGR 通道顺序，0=B, 1=G, 2=R)
    # 绿色通道在眼底彩照中对视网膜血管和微出血点的对比度最高
    b, g, r = cv2.split(img_resized)
    
    # 4. 初始化 CLAHE 算子 
    # clipLimit=3.0 控制对比度上限防止噪声过载，tileGridSize=(8,8) 代表划分成 64 个网格局部均衡
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    g_enhanced = clahe.apply(g)
    
    # 5. 为了保持前端单色显示的高科技质感，我们将增强后的单通道转回伪三通道灰度图
    img_enhanced_preview = cv2.merge([g_enhanced, g_enhanced, g_enhanced])
    
    # 6. 将处理后的 OpenCV 矩阵在内存中编码为 JPEG 字节流
    _, buffer = cv2.imencode('.jpg', img_enhanced_preview, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    
    # 7. 转为 Base64 编码字符串，方便 Next.js 直接通过 JSON 吞下并渲染
    base64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_str}"


@app.post("/api/v1/diagnose", status_code=status.HTTP_200_OK)
async def diagnose_retina(file: UploadFile = File(...)):
    """保持第一阶段的分类指标接口，新增返回任务 ID 用作流式关联"""
    start_time = time.time()
    contents = await file.read()
    
    try:
        enhanced_base64 = process_fundus_pipeline(contents)
    except Exception:
        enhanced_base64 = ""

    # 模拟快速分类计算
    await asyncio.sleep(0.2)
    latency = f"{int((time.time() - start_time) * 1000)}ms"

    return {
        "task_id": f"task_{int(time.time())}",
        "status": "success",
        "metrics": {
            "dr_grade": 2,          
            "glaucoma_risk": 0.12,  
            "amd_risk": 0.05        
        },
        "enhanced_image": enhanced_base64,
        "latency": latency
    }

# === 核心突破：多模态大模型 SSE 流式报告接口 ===
@app.get("/api/v1/report/stream")
async def stream_ocular_report(task_id: str):
    """
    根据前端传来的任务 ID，模拟本地多模态大模型（如 Qwen-VL）
    对增强后影像的语义解析，流式逐字推送结构化中文病历。
    """
    
    medical_report_template = (
        f"【OcularAI 智能眼底分析报告】\n"
        f"涉及任务追踪码：{task_id}\n"
        f"----------------------------------------\n"
        f"一、影像特征解析：\n"
        f"经本院节点本地边缘算力增强，视网膜绿色通道 CLAHE 图像清晰。血管形态学扫描显示：后极部视网膜黄斑区外上方可见数个微血管瘤（Microaneurysms），并伴有少量点状深层出血灶（Hemorrhages）。硬性渗出（Hard Exudates）未见明显边缘扩散。视盘（Optic Disc）边界清晰，杯盘比（C/D Ratio）约为 0.35，处于正常生理临界值内。\n\n"
        f"二、临床诊断建议（AI 预分期）：\n"
        f"1. 糖尿病视网膜病变（DR）风险锁定位：2期（轻度非增殖期 / Mild NPDR）。\n"
        f"2. 青光眼（Glaucoma）及黄斑变性（AMD）目前评估为低风险。\n\n"
        f"三、后续随访与处置指南：\n"
        f"建议患者严格控制全天血糖与血压水平，于 6 个月内复查眼底彩照或进行 OCT 深度扫描。AI 提示局部病灶存在微小渗漏风险，请结合临床眼科专家复核签字确认。"
    )

    async def event_generator():
        chunk_size = 3
        for i in range(0, len(medical_report_template), chunk_size):
            chunk = medical_report_template[i:i+chunk_size]
            yield {
                "event": "message",
                "id": str(i),
                "data": chunk 
            }
            await asyncio.sleep(0.03)
            
        # 传输流结束的信号
        yield {"event": "done", "data": "[EOF]"}

    # ============= 核心修复：在这里手动注入强力的流式跨域和保活标头 =============
    return EventSourceResponse(
        event_generator(),
        headers={
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Credentials": "true",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )