#define WIN32_LEAN_AND_MEAN
#include <windows.h>

namespace {

// 启动普通权限的几乎不可见前台窗口, 用于让系统 PrtScn 映射正确

constexpr UINT kInputCount = 2;
constexpr int kFocusAttempts = 5;
constexpr DWORD kFocusDelayMs = 80;
constexpr DWORD kWindowLifetimeMs = 250;
constexpr int kForwardWindowSize = 1;
constexpr BYTE kForwardWindowAlpha = 1;
constexpr wchar_t kForwardWindowClassName[] = L"SparklePrtScnMediumWindow";

constexpr DWORD kExitOk = 0;
constexpr DWORD kExitTokenInvalid = 2;
constexpr DWORD kExitWindowCreateFailed = 3;
constexpr DWORD kExitFocusFailed = 4;
constexpr DWORD kExitSendFailed = 5;

void ClearMemory(void* buffer, SIZE_T size) {
  // no-CRT 构建下工具函数
  auto* bytes = static_cast<volatile unsigned char*>(buffer);
  for (SIZE_T i = 0; i < size; i++) {
    bytes[i] = 0;
  }
}

bool IsSpace(wchar_t value) {
  return value == L' ' || value == L'\t';
}

bool StartsWith(const wchar_t* value, const wchar_t* prefix) {
  while (*prefix != L'\0') {
    if (*value != *prefix) {
      return false;
    }
    value++;
    prefix++;
  }

  return true;
}

const wchar_t* FindArgValue(const wchar_t* commandLine, const wchar_t* name) {
  for (const wchar_t* current = commandLine; *current != L'\0'; current++) {
    if (current != commandLine && !IsSpace(*(current - 1))) {
      continue;
    }

    if (!StartsWith(current, name)) {
      continue;
    }

    current += lstrlenW(name);
    if (!IsSpace(*current)) {
      continue;
    }

    while (IsSpace(*current)) {
      current++;
    }
    return current;
  }

  return nullptr;
}

bool ParseLongArg(const wchar_t* commandLine, const wchar_t* name, LONG* value) {
  const wchar_t* current = FindArgValue(commandLine, name);
  if (current == nullptr) {
    return false;
  }

  bool negative = false;
  if (*current == L'-') {
    negative = true;
    current++;
  }

  LONG parsed = 0;
  bool hasDigit = false;
  while (*current >= L'0' && *current <= L'9') {
    parsed = parsed * 10 + (*current - L'0');
    hasDigit = true;
    current++;
  }

  if (!hasDigit) {
    return false;
  }

  *value = negative ? -parsed : parsed;
  return true;
}

bool GetTokenElevationFlag(HANDLE token, DWORD* elevated) {
  TOKEN_ELEVATION elevation;
  DWORD returned = 0;
  if (!GetTokenInformation(token, TokenElevation, &elevation, sizeof(elevation), &returned)) {
    return false;
  }

  *elevated = elevation.TokenIsElevated;
  return true;
}

bool GetTokenIntegrityRid(HANDLE token, DWORD* rid) {
  DWORD length = 0;
  GetTokenInformation(token, TokenIntegrityLevel, nullptr, 0, &length);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || length == 0) {
    return false;
  }

  BYTE* buffer = static_cast<BYTE*>(HeapAlloc(GetProcessHeap(), 0, length));
  if (buffer == nullptr) {
    return false;
  }

  bool ok = false;
  if (GetTokenInformation(token, TokenIntegrityLevel, buffer, length, &length)) {
    auto* label = reinterpret_cast<TOKEN_MANDATORY_LABEL*>(buffer);
    DWORD subAuthorityCount = *GetSidSubAuthorityCount(label->Label.Sid);
    *rid = *GetSidSubAuthority(label->Label.Sid, subAuthorityCount - 1);
    ok = true;
  }

  HeapFree(GetProcessHeap(), 0, buffer);
  return ok;
}

bool IsCurrentProcessMediumNonElevated() {
  // helper 若被错误地以管理员权限运行, 直接退出, 避免回到原始问题
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) {
    return false;
  }

  DWORD elevated = 1;
  DWORD integrityRid = 0;
  const bool ok = GetTokenElevationFlag(token, &elevated) && elevated == 0 &&
                  GetTokenIntegrityRid(token, &integrityRid) &&
                  integrityRid == SECURITY_MANDATORY_MEDIUM_RID;
  CloseHandle(token);
  return ok;
}

LRESULT CALLBACK ForwardWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  if (message == WM_ERASEBKGND) {
    return 1;
  }

  if (message == WM_PAINT) {
    PAINTSTRUCT paint;
    BeginPaint(window, &paint);
    EndPaint(window, &paint);
    return 0;
  }

  return DefWindowProcW(window, message, wParam, lParam);
}

bool RegisterForwardWindowClass() {
  WNDCLASSEXW windowClass;
  ClearMemory(&windowClass, sizeof(windowClass));
  windowClass.cbSize = sizeof(windowClass);
  windowClass.lpfnWndProc = ForwardWindowProc;
  windowClass.hInstance = GetModuleHandleW(nullptr);
  windowClass.lpszClassName = kForwardWindowClassName;

  ATOM atom = RegisterClassExW(&windowClass);
  return atom != 0 || GetLastError() == ERROR_CLASS_ALREADY_EXISTS;
}

HWND CreateForwardWindow(LONG x, LONG y) {
  if (!RegisterForwardWindowClass()) {
    return nullptr;
  }

  // 近透明窗口必须可激活为前台窗口; 不要使用 WS_EX_NOACTIVATE
  HWND window = CreateWindowExW(
    WS_EX_TOOLWINDOW | WS_EX_LAYERED | WS_EX_TOPMOST,
    kForwardWindowClassName,
    L"",
    WS_POPUP,
    x,
    y,
    kForwardWindowSize,
    kForwardWindowSize,
    nullptr,
    nullptr,
    GetModuleHandleW(nullptr),
    nullptr
  );
  if (window == nullptr) {
    return nullptr;
  }

  SetLayeredWindowAttributes(window, 0, kForwardWindowAlpha, LWA_ALPHA);
  ShowWindow(window, SW_SHOW);
  UpdateWindow(window);
  return window;
}

bool FocusForwardWindow(HWND window) {
  for (int i = 0; i < kFocusAttempts; i++) {
    SetForegroundWindow(window);
    if (GetForegroundWindow() == window) {
      return true;
    }

    if (i + 1 < kFocusAttempts) {
      Sleep(kFocusDelayMs);
    }
  }

  return false;
}

UINT SendPrintScreen() {
  INPUT inputs[kInputCount];
  ClearMemory(inputs, sizeof(inputs));

  inputs[0].type = INPUT_KEYBOARD;
  inputs[0].ki.wVk = VK_SNAPSHOT;

  inputs[1].type = INPUT_KEYBOARD;
  inputs[1].ki.wVk = VK_SNAPSHOT;
  inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;

  return SendInput(kInputCount, inputs, sizeof(INPUT));
}

DWORD RunHelper() {
  if (!IsCurrentProcessMediumNonElevated()) {
    return kExitTokenInvalid;
  }

  LONG x = 0;
  LONG y = 0;
  const wchar_t* commandLine = GetCommandLineW();
  ParseLongArg(commandLine, L"--x", &x);
  ParseLongArg(commandLine, L"--y", &y);

  HWND window = CreateForwardWindow(x, y);
  if (window == nullptr) {
    return kExitWindowCreateFailed;
  }

  if (!FocusForwardWindow(window)) {
    DestroyWindow(window);
    return kExitFocusFailed;
  }

  // 此时前台窗口是普通权限 helper, PrtScn 绕过 UIPI 限制
  const UINT sent = SendPrintScreen();
  // SendInput 只是入队输入事件; 短暂保留窗口, 避免系统尚未处理时焦点回到 Sparkle
  Sleep(kWindowLifetimeMs);
  DestroyWindow(window);

  return sent == kInputCount ? kExitOk : kExitSendFailed;
}

}

extern "C" void __stdcall wWinMainCRTStartup() {
  ExitProcess(RunHelper());
}
