import os
import tempfile

import cv2
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS


SEQ_LEN = 10       
HEIGHT = 64
WIDTH = 64
THRESHOLD = 0.5       
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "mob_violence_model.h5")

# ---------------- Load model ---------------- #

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model not found at {MODEL_PATH}")

print("Loading model from:", MODEL_PATH)
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded successfully.")

# ---------------- Flask app ---------------- #

app = Flask(__name__)
CORS(app)


def video_to_sequence(video_path, seq_len=SEQ_LEN, height=HEIGHT, width=WIDTH):
    """Read video and sample seq_len frames → (1, seq_len, H, W, 3)"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return None

    indices = np.linspace(0, total_frames - 1, seq_len, dtype=int)
    index_set = set(indices)

    frames = []
    idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if idx in index_set:
            frame = cv2.resize(frame, (width, height))
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame)
        idx += 1

    cap.release()

    if len(frames) == 0:
        return None

    while len(frames) < seq_len:
        frames.append(frames[-1])

    arr = np.array(frames[:seq_len], dtype=np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)  # (1, seq_len, H, W, 3)
    return arr


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict_clip", methods=["POST"])
def predict_clip():
    """
    Expects: multipart/form-data with field "video"
    Returns: { "probability": float (violence prob), "label": "violent" | "non-violent" }
    """
    if "video" not in request.files:
        return jsonify({"error": "No 'video' file in request"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # Save uploaded video to a temp file
    fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    file.save(tmp_path)

    try:
        seq = video_to_sequence(tmp_path)
        if seq is None:
            return jsonify({"error": "Could not read video frames"}), 400

        # Softmax model output: [non_violent_prob, violent_prob]
        pred = model.predict(seq, verbose=0)[0]
        prob_non_violent = float(pred[0])
        prob_violent = float(pred[1])

        prob = prob_violent
        label = "violent" if prob_violent >= THRESHOLD else "non-violent"

        return jsonify({
            "probability": prob,
            "label": label,
            "raw_probs": {
                "non_violent": prob_non_violent,
                "violent": prob_violent
            }
        })
    except Exception as e:
        print("Error during prediction:", e)
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
