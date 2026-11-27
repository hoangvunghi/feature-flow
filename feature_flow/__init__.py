# path: feature_flow/__init__.py
"""feature-flow â€” thÆ° viá»‡n váº½ + visualize luá»“ng ship/debug má»™t tÃ­nh nÄƒng.

- LÃªn plan báº±ng code:   from feature_flow import Flow
- NhÃºng vÃ o app khÃ¡c:   from feature_flow import create_app
- Cháº¡y riÃªng:           uvicorn feature_flow.server:app --reload
"""
from .model import Edge, Flow, Node, list_flows

__version__ = "0.3.0"
__all__ = ["Flow", "Node", "Edge", "list_flows", "create_app", "__version__"]


def __getattr__(name: str):
    # import lÆ°á»i: dÃ¹ng Flow (lÃªn plan báº±ng code) khÃ´ng cáº§n cÃ i/khá»Ÿi táº¡o FastAPI
    if name == "create_app":
        from .server import create_app
        return create_app
    raise AttributeError(name)
