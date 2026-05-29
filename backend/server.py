import flwr as fl
from typing import List, Tuple, Optional, Dict
import numpy as np

# 定义一个回调函数，用于在中央查看每一轮聚合后的性能指标
def evaluate_config(server_round: int) -> Dict:
    return {"server_round": server_round}

def main():
    print("====================================================")
    print("     OcularAI 联邦学习中央聚合中心 (FedAvg Server)   ")
    print("====================================================")

    # 1. 配置联邦聚合策略 (Strategy)
    # 我们使用经典的 FedAvg 算法
    strategy = fl.server.strategy.FedAvg(
        fraction_fit=1.0,          # 每轮训练抽取 100% 的可用客户端参与
        fraction_evaluate=1.0,     # 每轮验证抽取 100% 的可用客户端参与
        min_fit_clients=2,         # 最少需要 2 个医院节点上线，才允许开启联邦训练
        min_evaluate_clients=2,    # 最少需要 2 个医院节点上线进行验证
        min_available_clients=2,   # 整个网络中处于待命状态的最低节点数
    )

    # 2. 点火中央服务器
    print("[SERVER] 📡 中央控制室已拉起，正在 8080 端口广播安全握手信号...")
    print("[SERVER] ⏱️ 正在等待至少 2 个医院节点（例如：院区A、院区B）接入以激活联合联邦训练流...\n")
    
    fl.server.start_server(
        server_address="127.0.0.1:8080",
        config=fl.server.ServerConfig(num_rounds=3), # 模拟跑 3 轮全球聚合迭代
        strategy=strategy
    )

if __name__ == "__main__":
    main()