import sys
import os

# Add the directory to path
sys.path.append(os.path.join(os.getcwd(), 'medsiglip_inference_endpoint'))

try:
    from handler import EndpointHandler
    print("Successfully imported EndpointHandler")
    import inspect
    
    if not hasattr(EndpointHandler, '__init__'):
        print("Error: EndpointHandler missing __init__")
        sys.exit(1)
        
    if not hasattr(EndpointHandler, '__call__'):
        print("Error: EndpointHandler missing __call__")
        sys.exit(1)
        
    sig = inspect.signature(EndpointHandler.__call__)
    if 'data' not in sig.parameters:
         print("Error: __call__ should accept 'data'")
         sys.exit(1)

    print("EndpointHandler structure verification passed.")
    
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Verification failed: {e}")
    sys.exit(1)
