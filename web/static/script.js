foldersLoaded = false; 
const IMAGE_SCALEDOWN = 8; // scale the canvas down by this factor to make it fit on screen
const IMAGE_RESOLUTION = 4032; // max
points = []
handleLength = 20
handleWidth = 4


// add a handle  points[]
function addPoint(event) {
    canvas = document.getElementById('display-pane');
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    if (points.length >= 4) {
        points.length = 0;  // remove old elements
    }
    points.push([x,y]);

    drawPoints()
}


// draw every handle contained by points[]
// called whenever handles are added or reset
function drawPoints() {
    canvas = document.getElementById('display-pane');
    ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#cc00ff"; // pink, to stand out against the green
    ctx.lineWidth = handleWidth
    for (let i = 0; i < points.length; i++) {
        // walking around the unit circle
        theta = (Math.PI / 4) + i*(Math.PI/2)
        x_sign = Math.sign(Math.cos(theta));
        y_sign = Math.sign(Math.sin(theta));

        point = points[i];
        x = point[0]; y = point[1]
        ctx.beginPath();
        ctx.moveTo(x,y); // place cursor
        ctx.lineTo(x + x_sign*handleLength, y);
        ctx.moveTo(x,y); // place cursor again
        ctx.lineTo(x, y + y_sign*handleLength);
        ctx.stroke();
    }
}


// empty out points[] 
function resetPoints() {
    while (points.length > 0) {
        points.shift()
    }
    drawPoints();
}


// submit a picture for projectionm
function submit() {
    folder = document.getElementById('folder-select').value;
    fileSelect = document.getElementById('file-select');
    file = fileSelect.value;
    index = fileSelect.selectedIndex;

    // we had to scale down the canvas to make it reasonably fit on a screen
    // now we scale the points back up...
    scaledPoints = points.map( 
        point => point.map(
            value => Math.round(value * IMAGE_SCALEDOWN)
        )
    )

    fetch('/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            points: scaledPoints,
            folder: folder,
            file: file
        }),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Success:', data);
            const homography = document.getElementById('homography-pane');
            homography.src = data.image_url;
            resetPoints();

            const download_button = document.getElementById('download');
            download_button.style.display = 'block';
            setFileList(index);
        })
        .catch((error) => {
            console.error(error)
            alert("Something went wrong. Please try again.");
        })
}


// open projected image in new tab
function download() {
    folder = document.getElementById('folder-select').value
    file = document.getElementById('file-select').value
    window.open(`/download/${folder}/${file}`)
}


// download zip file of selected folder's projections
function downloadFolder() {
    folder = document.getElementById('folder-select').value
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = `/download-folder/${folder}`;
    a.download = "projections.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);}


// send the list of folders in web/static/display to frontend
function setFolderList() {
    fetch('/get-folders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Success:', data)
            let selector = document.getElementById('folder-select')
            selector.innerHTML = ''
            let items = data['items']
            items.sort()
            for (i in items) {
                selector.options.add(new Option(items[i], items[i]))
            }
            // hack for auto-selecting first element
            if (!foldersLoaded) {
                foldersLoaded = true;
                selector.selectedIndex = 0;
                setFileList(0);
            }
        })
        .catch((error) => {
            console.error('Error:', error)
        })
}


// send the list of a files in a provided folder to the frontend
function setFileList(index=-1) {
    const folder = document.getElementById('folder-select').value;

    fetch('/get-photos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(folder)
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Success:', data)
            let selector = document.getElementById('file-select')
            selector.innerHTML = ''
            let items = data['items']
            items.sort()
            for (i in items) {
                selector.options.add(new Option(items[i]['text'], items[i]['value']))
            }
            selector.selectedIndex = index;
        })
        .catch((error) => {
            alert("Unable to find folder for " + folder);
        })
}


// set the background image of the canvas element
function setPhoto() {
    const folder = document.getElementById('folder-select').value
    const file = document.getElementById('file-select').value

    fetch('/show-picture', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({folder: folder, file: file})
    })
        .then((response) => response.json())
        .then((data) => {
            console.log('Success:', data);
            const canvas = document.getElementById('display-pane');
            const homography = document.getElementById('homography-pane');
            const download_button = document.getElementById('download');

            canvas.style.backgroundImage = `url('${data.image_url}')`;

            h_url = data.h_url;
            if (h_url != null){
                homography.src = h_url;
                download_button.style.display = 'block';
            } else {
                homography.src = '/display/noimage.png';
                download_button.style.display = 'none';
            }
        })
        .catch((error) => {
            console.error(error)
            alert("Unable to find file " + file + " in folder " + folder);
        })}
    
window.onload = function () {
    console.log('Page loaded!');
    setFolderList();
    const canvas = document.getElementById('display-pane');
    canvas.width = Math.round(IMAGE_RESOLUTION / IMAGE_SCALEDOWN);
    canvas.height = Math.round(IMAGE_RESOLUTION / IMAGE_SCALEDOWN);

    const homography = document.getElementById('homography-pane');
    homography.width = Math.round(IMAGE_RESOLUTION / IMAGE_SCALEDOWN);
    homography.height = Math.round(IMAGE_RESOLUTION / IMAGE_SCALEDOWN);
}