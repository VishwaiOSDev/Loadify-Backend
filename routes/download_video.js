const fs = require("fs");
const cp = require("child_process");
const ytdl = require("ytdl-core");
const router = require("express").Router();
const ffmpeg = require("ffmpeg-static");

const constants = require("../lib/constants");
const getVideoDetailsOf = require("../lib/get_video_details");

router.get("/mp4", async (req, res) => {
  const video_url = req.query.url;
  const video_id = req.query.url.split("v=")[1];
  const video_quality = req.query.video_quality;
  const video_details = await getVideoDetailsOf(video_id);
  switch (video_quality) {
    case constants.QUALITY.LOW:
      downloadFromYTDL();
      break;
    case constants.QUALITY.MEDIUM:
      downloadFromYTDL("136");
      break;
    case constants.QUALITY.HIGH:
      downloadFromYTDL("137");
      break;
    default:
      res
        .status(400)
        .json({ message: "Quality of the video is not specified" });
  }

  function downloadFromYTDL(iTag) {
    if (iTag) {
      audioAndVideoMuxer(iTag);
    } else {
      const video = ytdl(video_url);
      video.pipe(
        fs.createWriteStream(
          `./videos/YouTube/${video_details.title} ?qty=${video_quality}.mp4`
        )
      );
      video.on("end", () => {
        res.status(200).json({ message: "Video File Downloaded" });
      });
      video.on("error", () => {
        res.json({ message: "Something went wrong" });
      });
    }
  }

  function audioAndVideoMuxer(iTag) {
    const tracker = {
      start: Date.now(),
      audio: { downloaded: 0, total: Infinity },
      video: { downloaded: 0, total: Infinity },
      merged: { frame: 0, speed: "0x", fps: 0 },
    };

    // Get audio and video streams
    const audio = ytdl(video_url, { quality: "highestaudio" }).on(
      "progress",
      (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      }
    );
    const video = ytdl(video_url, { quality: iTag }).on(
      "progress",
      (_, downloaded, total) => {
        tracker.video = { downloaded, total };
      }
    );
    // Start the ffmpeg child process
    const ffmpegProcess = cp.spawn(
      ffmpeg,
      [
        // Remove ffmpeg's console spamming
        "-loglevel",
        "8",
        "-hide_banner",
        // Redirect/Enable progress messages
        "-progress",
        "pipe:3",
        // Set inputs
        "-i",
        "pipe:4",
        "-i",
        "pipe:5",
        // Map audio & video from streams
        "-map",
        "0:a",
        "-map",
        "1:v",
        // Keep encoding
        "-c:v",
        "copy",
        // Define output file
        `./videos/YouTube/${video_details.title} ?qty=${video_quality}.mp4`,
      ],
      {
        windowsHide: true,
        stdio: [
          /* Standard: stdin, stdout, stderr */
          "inherit",
          "inherit",
          "inherit",
          /* Custom: pipe:3, pipe:4, pipe:5 */
          "pipe",
          "pipe",
          "pipe",
        ],
      }
    );
    ffmpegProcess.on("close", () => {
      res.json({ message: "Video file downloaded" });
    });
    ffmpegProcess.on("error", () => {
      res.json({ message: "Something when wrong" });
    });
    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
  }
});

module.exports = router;
