import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import sharp from 'sharp';

/**
 * 视频壁纸缩略图生成器
 * 使用 ffmpeg 提取视频帧，sharp 缩放到缩略图尺寸
 */

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;

/** 获取 ffmpeg 可执行文件路径 */
function getFfmpegPath(): string {
  try {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    return ffmpeg.path;
  } catch {
    return 'ffmpeg';
  }
}

/** 获取 ffprobe 可执行文件路径（与 ffmpeg 同目录） */
function getFfprobePath(): string {
  const ffmpegPath = getFfmpegPath();
  const dir = path.dirname(ffmpegPath);
  const probeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const probePath = path.join(dir, probeName);
  if (fs.existsSync(probePath)) return probePath;
  return 'ffprobe';
}

/** 支持的 Chromium 可播放视频格式 */
const CHROMIUM_VIDEO_EXTS = ['.mp4', '.webm'];
/** 所有可导入的视频格式 */
const ALL_VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];

export function isVideoFile(filePath: string): boolean {
  return ALL_VIDEO_EXTS.includes(path.extname(filePath).toLowerCase());
}

export function isChromiumPlayable(filePath: string): boolean {
  return CHROMIUM_VIDEO_EXTS.includes(path.extname(filePath).toLowerCase());
}

/**
 * 获取视频时长和分辨率（使用 ffprobe）
 */
export async function getVideoInfo(videoPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
} | null> {
  const ffprobe = getFfprobePath();

  return new Promise((resolve) => {
    execFile(ffprobe, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath,
    ], { timeout: 15000 }, (err, stdout) => {
      if (err) {
        console.error('[VideoThumbnail] ffprobe failed:', err.message);
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const videoStream = (data.streams || []).find(
          (s: Record<string, unknown>) => s.codec_type === 'video'
        );
        const duration = parseFloat(data.format?.duration) || 0;
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;
        resolve({ duration: Math.round(duration), width, height });
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * 生成视频壁纸缩略图
 * 提取第 1 秒（或 10% 处）的帧，缩放到 320x180 保存为 JPEG
 *
 * @param videoPath 视频文件路径
 * @param thumbnailDir 缩略图保存目录
 * @param wallpaperId 壁纸 ID（用于文件名）
 * @returns 缩略图文件路径，失败返回 null
 */
export async function generateVideoThumbnail(
  videoPath: string,
  thumbnailDir: string,
  wallpaperId: string
): Promise<string | null> {
  const ffmpeg = getFfmpegPath();

  // 在 1 秒处截取帧（短视频在 0.5s）
  const timestamp = '00:00:01';
  const tmpPng = path.join(thumbnailDir, `tmp_video_${wallpaperId}.png`);
  const thumbPath = path.join(thumbnailDir, `html_${wallpaperId}_thumb.jpg`);

  return new Promise((resolve) => {
    execFile(ffmpeg, [
      '-ss', timestamp,
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      tmpPng,
    ], { timeout: 30000 }, async (err) => {
      if (err) {
        console.error('[VideoThumbnail] ffmpeg frame extraction failed:', err.message);
        resolve(null);
        return;
      }

      try {
        await sharp(tmpPng)
          .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toFile(thumbPath);

        // 清理临时 PNG
        if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);

        resolve(thumbPath);
      } catch (sharpErr) {
        console.error('[VideoThumbnail] sharp resize failed:', sharpErr);
        resolve(null);
      }
    });
  });
}
