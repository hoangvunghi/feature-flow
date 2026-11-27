# path: feature_flow/__init__.py
"""feature-flow — thư viện vẽ + visualize luồng ship/debug một tính năng.

- Lên plan bằng code:   from feature_flow import Flow
- Nhúng vào app khác:   from feature_flow import create_app
- Chạy riêng:           uvicorn feature_flow.server:app --reload
"""
from .model import Edge, Flow, Node, list_flows

__version__ = "0.3.0"
__all__ = ["Flow", "Node", "Edge", "list_flows", "create_app", "__version__"]


def __getattr__(name: str):
    # import lười: dùng Flow (lên plan bằng code) không cần cài/khởi tạo FastAPI
    if name == "create_app":
        from .server import create_app
        return create_app
    raise AttributeError(name)
