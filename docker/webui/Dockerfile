FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*
RUN pip install --upgrade pip
RUN pip install gradio librosa requests redis
COPY ui.py .
CMD ["python", "ui.py"]
