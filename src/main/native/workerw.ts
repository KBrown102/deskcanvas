/**
 * WorkerW 窗口注入模块（基于 koffi FFI，无需 C++ 编译工具链）
 * 将 BrowserWindow 嵌入到 Windows 桌面图标层之下，实现 HTML 动态壁纸
 */

import koffi from 'koffi';

// user32.dll 函数绑定（延迟初始化）
let user32Loaded = false;
let FindWindowA: (className: string | null, windowName: string | null) => bigint;
let GetClassNameA: (hwnd: bigint, buf: Buffer, maxCount: number) => number;
let SendMessageTimeoutA: (
  hwnd: bigint, msg: number, wParam: number, lParam: number,
  flags: number, timeout: number, result: null
) => bigint;
let EnumWindows: (callback: unknown, lParam: number) => boolean;
let FindWindowExA: (
  parent: bigint, childAfter: bigint,
  className: string | null, windowName: string | null
) => bigint;
let GetWindow: (hwnd: bigint, cmd: number) => bigint;
let SetParent: (child: bigint, newParent: bigint) => bigint;
let SetWindowLongA: (hwnd: bigint, index: number, newLong: number) => number;
let ShowWindow: (hwnd: bigint, cmd: number) => boolean;
let SetWindowPos: (
  hwnd: bigint, hWndInsertAfter: bigint,
  x: number, y: number, cx: number, cy: number, flags: number
) => boolean;

function loadUser32(): boolean {
  if (user32Loaded) return true;
  try {
    const lib = koffi.load('user32.dll');

    FindWindowA = lib.func('void* FindWindowA(str lpClassName, str lpWindowName)');
    GetClassNameA = lib.func('int32 GetClassNameA(void* hWnd, void* lpClassName, int32 nMaxCount)');
    SendMessageTimeoutA = lib.func(
      'intptr SendMessageTimeoutA(void* hWnd, uint32 Msg, uintptr wParam, intptr lParam, ' +
      'uint32 fuFlags, uint32 uTimeout, void* lpdwResult)'
    );
    FindWindowExA = lib.func(
      'void* FindWindowExA(void* hWndParent, void* hWndChildAfter, str lpszClass, str lpszWindow)'
    );
    GetWindow = lib.func('void* GetWindow(void* hWnd, uint32 uCmd)');
    SetParent = lib.func('void* SetParent(void* hWndChild, void* hWndNewParent)');
    SetWindowLongA = lib.func('int32 SetWindowLongA(void* hWnd, int32 nIndex, int32 dwNewLong)');
    ShowWindow = lib.func('bool ShowWindow(void* hWnd, int32 nCmdShow)');
    SetWindowPos = lib.func(
      'bool SetWindowPos(void* hWnd, void* hWndInsertAfter, int32 X, int32 Y, int32 cx, int32 cy, uint32 uFlags)'
    );

    // EnumWindows 回调需要特殊处理：先定义 proto，再取 pointer
    const WNDENUMPROC = koffi.proto('WNDENUMPROC', 'bool', ['void*', 'intptr']);
    EnumWindows = lib.func('bool EnumWindows(WNDENUMPROC *, intptr)');

    // 保存回调类型供 register 使用
    (loadUser32 as any)._wndEnumProcPtr = koffi.pointer(WNDENUMPROC);

    user32Loaded = true;
    return true;
  } catch (err) {
    console.error('[WorkerW] Failed to load user32.dll via koffi:', err);
    return false;
  }
}

// 常量
const SMTO_NORMAL = 0x0000;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_VISIBLE = 0x10000000;
const WS_CHILD = 0x40000000;
const WS_EX_LAYERED = 0x00080000;
const WS_EX_TRANSPARENT = 0x00000020;
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const GW_CHILD = 5; // GetWindow cmd: first child window

let workerwHandle: bigint = 0n;

/**
 * 初始化 WorkerW 窗口
 * 通过向 Progman 发送 0x052C 消息，触发系统创建 WorkerW 层
 */
function initWorkerW(): boolean {
  console.log('[WorkerW] initWorkerW() called');
  if (!loadUser32()) {
    console.error('[WorkerW] Failed to load user32.dll');
    return false;
  }
  console.log('[WorkerW] user32.dll loaded OK');

  workerwHandle = 0n;

  // 获取 Progman 窗口
  const progman = FindWindowA('Progman', null);
  console.log('[WorkerW] FindWindowA Progman result:', progman);
  if (progman === 0n) {
    console.error('[WorkerW] Failed to find Progman window');
    return false;
  }

  // 发送 0x052C 消息，触发 WorkerW 创建
  try {
    SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, null);
    console.log('[WorkerW] SendMessageTimeout 0x052C sent OK');
  } catch (e) {
    console.error('[WorkerW] SendMessageTimeout failed:', e);
  }

  // 等待 WorkerW 创建完成
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); } catch { /* best-effort delay */ }

  // 枚举所有顶层窗口，用 GetClassNameA 识别 WorkerW
  const wndEnumProcPtr = (loadUser32 as any)._wndEnumProcPtr;
  const allWorkerW: bigint[] = [];
  let iconWorkerW: bigint = 0n;
  const classNameBuf = Buffer.alloc(256);
  let enumCount = 0;

  const callback = koffi.register((hwnd: bigint, _lParam: number): boolean => {
    enumCount++;
    const len = GetClassNameA(hwnd, classNameBuf, 256);
    if (len > 0) {
      const name = classNameBuf.toString('ascii', 0, len);
      if (name === 'WorkerW') {
        allWorkerW.push(hwnd);
        // 用 GetWindow(GW_CHILD) 只检查直接子窗口
        // FindWindowExA 会搜索所有后代，导致误判
        const firstChild = GetWindow(hwnd, GW_CHILD);
        if (firstChild !== 0n) {
          const childLen = GetClassNameA(firstChild, classNameBuf, 256);
          if (childLen > 0) {
            const childName = classNameBuf.toString('ascii', 0, childLen);
            if (childName === 'SHELLDLL_DefView') {
              iconWorkerW = hwnd;
              console.log('[WorkerW] Found icon layer WorkerW (direct child):', hwnd);
            }
          }
        }
      }
    }
    return true;
  }, wndEnumProcPtr);

  console.log('[WorkerW] Starting EnumWindows...');
  try {
    EnumWindows(callback, 0);
  } catch (e) {
    console.error('[WorkerW] EnumWindows threw exception:', e);
  }
  console.log('[WorkerW] EnumWindows done, enumerated', enumCount, 'windows');
  console.log('[WorkerW] Total WorkerW found:', allWorkerW.length, 'Icon WorkerW:', iconWorkerW);

  if (allWorkerW.length === 0) {
    console.error('[WorkerW] No WorkerW windows found');
    return false;
  }

  // EnumWindows 按 z-order 从前到后枚举
  // 桌面层级（前→后）：图标 WorkerW (SHELLDLL_DefView) → 背景 WorkerW → ... → Progman
  // 我们需要选图标 WorkerW 后面紧挨着的那个（z-order 中刚好在图标层下方）
  let bgHandle: bigint = 0n;
  if (iconWorkerW !== 0n) {
    const iconIndex = allWorkerW.indexOf(iconWorkerW);
    if (iconIndex >= 0 && iconIndex + 1 < allWorkerW.length) {
      bgHandle = allWorkerW[iconIndex + 1];
      console.log('[WorkerW] Selected WorkerW directly behind icon layer:', bgHandle);
    } else {
      console.error('[WorkerW] Icon WorkerW is the last one — no background layer available');
      return false;
    }
  } else if (allWorkerW.length >= 2) {
    // 没找到图标层但有多个 WorkerW，选第二个（保守估计）
    bgHandle = allWorkerW[1];
    console.log('[WorkerW] Fallback: icon layer not found, using second WorkerW:', bgHandle);
  } else {
    console.error('[WorkerW] Cannot find background WorkerW (only found one, no icon layer)');
    return false;
  }
  workerwHandle = bgHandle;

  return workerwHandle !== 0n;
}

/**
 * 将 BrowserWindow 嵌入到桌面 WorkerW 层
 *
 * @param hwnd bigint | Buffer - BrowserWindow 的 NativeWindowHandle
 * @returns 是否成功嵌入
 */
export function injectIntoDesktop(hwnd: bigint | Buffer): boolean {
  if (!loadUser32()) {
    console.error('[WorkerW] FFI not available');
    return false;
  }

  // 将 Buffer 转为 bigint（getNativeWindowHandle 在 Electron 中返回 Buffer）
  let hwndBig: bigint;
  if (Buffer.isBuffer(hwnd)) {
    hwndBig = hwnd.readBigUInt64LE(0);
  } else {
    hwndBig = hwnd;
  }

  console.log('[WorkerW] injectIntoDesktop called with hwnd:', hwndBig);

  // 每次注入前都重新初始化 WorkerW
  // Explorer 重启后旧的 WorkerW 句柄会失效，必须重新枚举
  if (!initWorkerW()) {
    console.error('[WorkerW] Failed to initialize WorkerW');
    return false;
  }

  if (workerwHandle === 0n) {
    console.error('[WorkerW] WorkerW handle is null');
    return false;
  }

  try {
    // 设置窗口样式为子窗口 + 可见
    const styleResult = SetWindowLongA(hwndBig, GWL_STYLE, WS_VISIBLE | WS_CHILD);
    console.log('[WorkerW] SetWindowLongA STYLE result:', styleResult);

    // 设置扩展样式为分层 + 透明
    const exStyleResult = SetWindowLongA(hwndBig, GWL_EXSTYLE, WS_EX_LAYERED | WS_EX_TRANSPARENT);
    console.log('[WorkerW] SetWindowLongA EXSTYLE result:', exStyleResult);

    // 将窗口设为 WorkerW 的子窗口
    const parentResult = SetParent(hwndBig, workerwHandle);
    console.log('[WorkerW] SetParent result:', parentResult);

    // 将窗口置于最底层
    const posResult = SetWindowPos(
      hwndBig, 1n, 0, 0, 0, 0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW
    );
    console.log('[WorkerW] SetWindowPos result:', posResult);

    console.log('[WorkerW] Successfully injected window into desktop');
    return true;
  } catch (err) {
    console.error('[WorkerW] Failed to inject window:', err);
    return false;
  }
}

/**
 * 获取 WorkerW 句柄（用于调试）
 */
export function getWorkerWHandle(): bigint {
  return workerwHandle;
}

/**
 * 重新初始化 WorkerW（Explorer 重启后调用）
 */
export function reinitWorkerW(): boolean {
  workerwHandle = 0n;
  return initWorkerW();
}

/**
 * 将窗口从 WorkerW 脱离（恢复为独立顶层窗口）
 * 在关闭窗口前调用，确保 WorkerW 层级不残留子窗口
 */
export function detachFromDesktop(hwnd: bigint | Buffer): boolean {
  if (!loadUser32()) return false;
  let hwndBig: bigint;
  if (Buffer.isBuffer(hwnd)) {
    hwndBig = hwnd.readBigUInt64LE(0);
  } else {
    hwndBig = hwnd;
  }
  try {
    // 恢复为独立窗口（parent = 0 → 桌面）
    SetParent(hwndBig, 0n);
    // 恢复为普通弹出窗口样式
    SetWindowLongA(hwndBig, GWL_STYLE, WS_VISIBLE | 0x00C00000 /* WS_OVERLAPPEDWINDOW */);
    SetWindowLongA(hwndBig, GWL_EXSTYLE, 0);
    console.log('[WorkerW] Detached window from desktop');
    return true;
  } catch (err) {
    console.error('[WorkerW] Failed to detach window:', err);
    return false;
  }
}

/**
 * 获取当前系统壁纸路径
 */
export function getWallpaperPath(): string | null {
  if (!loadUser32()) return null;
  try {
    const lib = koffi.load('user32.dll');
    const SystemParametersInfoW = lib.func(
      'bool SystemParametersInfoW(uint32 uiAction, uint32 uiParam, void* pvParam, uint32 fWinIni)'
    );
    const buf = Buffer.alloc(520); // MAX_PATH * 2 (wide chars)
    const SPI_GETDESKWALLPAPER = 0x0073;
    const ok = SystemParametersInfoW(SPI_GETDESKWALLPAPER, 260, buf, 0);
    if (ok) {
      const path = buf.toString('utf16le').replace(/\0+$/, '');
      return path || null;
    }
    return null;
  } catch {
    return null;
  }
}
