import base64
import io
import json
import sys


def load_numpy(data):
    import numpy as np
    buffer = io.BytesIO(data)
    return np.load(buffer, allow_pickle=False)


def save_numpy(array):
    import numpy as np
    buffer = io.BytesIO()
    np.save(buffer, array)
    return buffer.getvalue()


def load_torch(data):
    import torch
    buffer = io.BytesIO(data)
    obj = torch.load(buffer, map_location="cpu")
    if isinstance(obj, torch.Tensor):
        return obj
    if isinstance(obj, dict):
        # Use the first tensor-like entry
        for value in obj.values():
            if isinstance(value, torch.Tensor):
                return value
    raise ValueError("Unsupported PyTorch payload. Expected Tensor or state dict containing Tensor.")


def save_torch(tensor):
    import torch
    buffer = io.BytesIO()
    torch.save(tensor, buffer)
    return buffer.getvalue()


def load_safetensors(data):
    from safetensors.torch import load
    tensors = load(io.BytesIO(data))
    if not tensors:
        raise ValueError("Empty safetensors payload")
    # Use the first tensor
    first_key = next(iter(tensors.keys()))
    return tensors[first_key]


def save_safetensors(tensor):
    from safetensors.torch import save
    buffer = io.BytesIO()
    save({"tensor": tensor}, buffer)
    return buffer.getvalue()


def load_onnx_tensor(data):
    import onnx
    from onnx import numpy_helper
    tensor_proto = onnx.TensorProto()
    tensor_proto.ParseFromString(data)
    return numpy_helper.to_array(tensor_proto)


def save_onnx_tensor(array):
    import onnx
    from onnx import numpy_helper
    tensor_proto = numpy_helper.from_array(array)
    return tensor_proto.SerializeToString()


def load_tensorflow_tensor(data):
    from tensorflow.core.framework import tensor_pb2
    from tensorflow.python.framework import tensor_util
    tensor_proto = tensor_pb2.TensorProto()
    tensor_proto.ParseFromString(data)
    return tensor_util.MakeNdarray(tensor_proto)


def save_tensorflow_tensor(array):
    from tensorflow.python.framework import tensor_util
    tensor_proto = tensor_util.make_tensor_proto(array)
    return tensor_proto.SerializeToString()


def main():
    payload = json.load(sys.stdin)
    raw = base64.b64decode(payload.get("vector_data", ""))
    source_format = payload.get("source_format")
    target_format = payload.get("target_format")

    if source_format == target_format:
        result = raw
    else:
        if source_format == "numpy":
            array = load_numpy(raw)
        elif source_format == "pytorch":
            array = load_torch(raw)
        elif source_format == "safetensors":
            array = load_safetensors(raw)
        elif source_format == "onnx":
            array = load_onnx_tensor(raw)
        elif source_format == "tensorflow":
            array = load_tensorflow_tensor(raw)
        else:
            raise ValueError(f"Unsupported source_format: {source_format}")

        if target_format == "numpy":
            if hasattr(array, "detach"):
                array = array.detach().cpu().numpy()
            result = save_numpy(array)
        elif target_format == "pytorch":
            import torch
            if not hasattr(array, "detach"):
                array = torch.from_numpy(array)
            result = save_torch(array)
        elif target_format == "safetensors":
            import torch
            if not hasattr(array, "detach"):
                array = torch.from_numpy(array)
            result = save_safetensors(array)
        elif target_format == "onnx":
            result = save_onnx_tensor(array)
        elif target_format == "tensorflow":
            result = save_tensorflow_tensor(array)
        else:
            raise ValueError(f"Unsupported target_format: {target_format}")

    sys.stdout.write(
        json.dumps(
            {
                "converted_data": base64.b64encode(result).decode("utf-8"),
                "source_format": source_format,
                "target_format": target_format,
            }
        )
    )


if __name__ == "__main__":
    main()
