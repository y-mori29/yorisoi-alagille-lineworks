const { execFile } = require('child_process');

/**
 * Executes FFmpeg with the given arguments.
 * 
 * @param {string[]} args - FFmpeg arguments.
 * @returns {Promise<void>}
 */
function execFFmpeg(args) {
    return new Promise((resolve, reject) => {
        // console.log("Running ffmpeg with:", args.join(" "));
        execFile("ffmpeg", ["-y", ...args], { windowsHide: true }, (err, stdout, stderr) => {
            if (err) {
                console.error("FFmpeg Error:", stderr);
                return reject(new Error(stderr || String(err)));
            }
            resolve();
        });
    });
}

module.exports = { execFFmpeg };
