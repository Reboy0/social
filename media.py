import os
import uuid
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')

ALLOWED = {
    'image': {'jpg', 'jpeg', 'png', 'gif', 'webp'},
    'video': {'mp4', 'mov', 'webm'},
    'audio': {'mp3', 'wav', 'ogg', 'm4a', 'aac'},
}

MAX_SIZE = {
    'image': 10 * 1024 * 1024,   # 10 MB
    'video': 100 * 1024 * 1024,  # 100 MB
    'audio': 20 * 1024 * 1024,   # 20 MB
}

SUBFOLDERS = {
    'image': 'images',
    'video': 'videos',
    'audio': 'audio',
}

def get_media_type(filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    for media_type, exts in ALLOWED.items():
        if ext in exts:
            return media_type
    return None

def save_file(file):
    """Save a file and return (filename, media_type) or (None, None) on error."""
    if not file or not file.filename:
        return None, None

    original = secure_filename(file.filename)
    media_type = get_media_type(original)
    if not media_type:
        return None, None

    # Check size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_SIZE[media_type]:
        return None, None

    ext = original.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    subfolder = SUBFOLDERS[media_type]
    dest_dir = os.path.join(UPLOAD_FOLDER, subfolder)
    os.makedirs(dest_dir, exist_ok=True)

    file.save(os.path.join(dest_dir, unique_name))
    relative_path = f"{subfolder}/{unique_name}"
    return relative_path, media_type

def delete_file(filename):
    """Delete a file from uploads folder."""
    if not filename:
        return
    path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(path):
        os.remove(path)