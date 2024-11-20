from flask import Flask, render_template, jsonify, send_from_directory, request
from pathlib import Path
from shutil import make_archive
import cv2 as cv, numpy as np

app = Flask(__name__, static_url_path='', static_folder='web/static', template_folder='web/templates')
here = Path(__file__).resolve().parent # folder that this script is contained in
display_dir = here / "web" / "static" / "display"

RESULT_RESOLUTION = 3024 # max resolution of input (assuming frames are square)
PROJECTION_CORNERS = [ # proceeding clockwise from top-left
    [0, 0],
    [RESULT_RESOLUTION, 0],
    [RESULT_RESOLUTION, RESULT_RESOLUTION],
    [0, RESULT_RESOLUTION]
]


@app.route('/')
def home():
    """
    Entrypoint.
    """
    app.logger.info("Connection succesful.")
    return render_template('index.html')


@app.route('/get-folders', methods=['POST'])
def get_folders():
    """
    Get list of stored folders in static folder.
    """
    files = [f.name for f in display_dir.iterdir() if f.is_dir()]
    if 'README' in files:
        files.remove('README')
    j = jsonify({'items': files}), 200
    return j


@app.route('/get-photos', methods=['POST'])
def get_photos():
    """
    Get list of stored photos in the provided folder, if it exists.
    Also show which files have a corresponding projection. 
    """
    photo_folder = request.json
    photo_dir = display_dir / photo_folder

    if not photo_dir.exists():
        return f"Folder {photo_folder} not found.", 400
    
    projections_dir = display_dir / photo_folder / "projections"
    projections_dir.mkdir(exist_ok=True)

    files = [(f.stem, f.suffix) 
             for f in photo_dir.iterdir() 
             if f.is_file() and f.stem != "README"]

    projections_dir = display_dir / photo_folder / "projections"
    projections_dir.mkdir(exist_ok=True)

    projections = [f.name 
                   for f in projections_dir.iterdir() 
                   if f.is_file() and f.stem != "README"]
    
    file_list = []
    for stem, suffix in files:
        value = f"{stem}{suffix}"
        if f"{stem}_H{suffix}" in projections:
            text = f"☑️{stem}{suffix}"
        else: 
            text = f"🟪{stem}{suffix}"
        file_list.append({"text": text, "value": value})

    file_list = sorted(file_list, key=lambda d: d['value'])
    j = jsonify({'items': file_list}), 200
    return j


@app.route('/show-picture', methods=['POST'])
def show_picture():
    """
    Get list of stored photos in the provided folder, if it exists.
    Also show the homography, if we have one.
    """
    data = request.json
    folder = data['folder']
    file = data['file']
    photo_path = display_dir / folder / file

    if not photo_path.exists():
        return f"File {file} not found in folder {folder}.", 400

    homography_path = display_dir / folder / "projections" / f"{photo_path.stem}_H{photo_path.suffix}"
    if not homography_path.exists():
        h_path = None
    else:
        h_path = f"/display/{folder}/projections/{homography_path.name}"
    
    relative_path = f"/display/{folder}/{file}"
    return {"image_url": relative_path, "h_url": h_path}, 200


@app.route('/submit', methods=['POST'])
def submit():
    """
    Receive the points from the front end to be used in homography on back end.
    """
    data = request.json
    points, folder, file = data.values()
    target = display_dir / folder / file
    if not target.exists():
        return f"File {file} not found in folder {folder}.", 400
    
    try:
        input_corners = np.array(points)
        projection = np.array(PROJECTION_CORNERS)
        image = cv.imread(target)
        H, _ = cv.findHomography(input_corners, projection)
        projected_image = cv.warpPerspective(image, H, (RESULT_RESOLUTION, RESULT_RESOLUTION))
    except:
        return f"Something went wrong with OpenCV", 500
    
    try:
        homography_dir = target.parent / "projections"
        homography_dir.mkdir(exist_ok=True)
        save_to = homography_dir / f"{target.stem}_H{target.suffix}"
        cv.imwrite(save_to, projected_image)
    except:
        return f"Something went wrong when saving the resulting image", 500
    
    return_path = f"/display/{folder}/projections/{save_to.name}"
    j = jsonify({'image_url': return_path}), 200
    return j


@app.route('/download', methods=['POST'])
def download():
    """
    Get's link for the selected file's projection.
    """
    data = request.json
    folder, file = data.values()
    ori = display_dir / folder / file
    projected_image = display_dir / folder / "projections" / f"{ori.stem}_H{ori.suffix}"
    if not projected_image.exists():
        return f"Could not find project for image {file} in folder {folder}.", 400
    
    j = jsonify({'image_url': f"/display/{folder}/projections/{ori.stem}_H{ori.suffix}"}), 200
    return j


@app.route('/download-folder/<folder>')
def download_folder(folder):
    """
    Sends a zip file of the selected directory.
    """
    target_dir = display_dir / folder / "projections"
    if not target_dir.exists():
        return f"Folder {folder} not found.", 400
    
    send_string = make_archive(here / "web" / "static" , 'zip', target_dir.parent, target_dir.name)
    send_path = Path(send_string)
    return send_from_directory(send_path.parent, send_path.name, as_attachment=True)


if __name__ == '__main__':
    app.run(debug=True, threaded=True)