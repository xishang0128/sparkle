#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <tlhelp32.h>

namespace {

// 在高权限 Sparkle 前台时, Windows 的裸 PrtScn 映射可能退回旧式全屏截图
// 这里捕获物理裸 PrtScn, 并通过普通权限 helper 重新触发系统截图路径

constexpr UINT kForwardMessage = WM_APP + 0x522c;
constexpr DWORD kForwardHelperTimeoutMs = 3000;

constexpr UINT kForwardNoTarget = 0;
constexpr UINT kForwardFocusFailed = 1;
constexpr UINT kForwardSendFailed = 2;
constexpr UINT kForwardSent = 3;
constexpr UINT kForwardPostFailed = 4;
constexpr DWORD kHookThreadStartupTimeoutMs = 3000;
constexpr DWORD kHookThreadShutdownTimeoutMs = 3000;
constexpr int kHookThreadPriority = THREAD_PRIORITY_HIGHEST;

constexpr wchar_t kPrtScnHelperFileName[] = L"prtscnhelper.exe";

// 此 addon 只动态解析需要的 N-API
using napi_env = void*;
using napi_value = void*;
using napi_callback_info = void*;
using napi_status = int;
using napi_callback = napi_value(__cdecl*)(napi_env env, napi_callback_info info);

using NapiGetCbInfo = napi_status(__cdecl*)(
  napi_env env,
  napi_callback_info info,
  size_t* argc,
  napi_value* argv,
  napi_value* thisArg,
  void** data
);
using NapiGetBigIntUint64 = napi_status(__cdecl*)(
  napi_env env,
  napi_value value,
  unsigned __int64* result,
  bool* lossless
);
using NapiGetBoolean = napi_status(__cdecl*)(napi_env env, bool value, napi_value* result);
using NapiCreateUint32 = napi_status(__cdecl*)(
  napi_env env,
  unsigned int value,
  napi_value* result
);
using NapiCreateFunction = napi_status(__cdecl*)(
  napi_env env,
  const char* utf8Name,
  size_t length,
  napi_callback cb,
  void* data,
  napi_value* result
);
using NapiSetNamedProperty = napi_status(__cdecl*)(
  napi_env env,
  napi_value object,
  const char* utf8Name,
  napi_value value
);
using NapiThrowError = napi_status(__cdecl*)(
  napi_env env,
  const char* code,
  const char* message
);
using NapiGetUndefined = napi_status(__cdecl*)(napi_env env, napi_value* result);

struct HookState {
  HWND window;
  WNDPROC previousWndProc;
  HHOOK keyboardHook;
  HANDLE hookThread;
  DWORD hookThreadId;
  HANDLE hookReadyEvent;
  bool hookReady;
  bool hookInstalled;
  bool forwarding;
  bool suppressKeyUp;
  UINT forwardCount;
  UINT lastStatus;
};

struct NapiApi {
  bool resolved;
  bool ok;
  NapiGetCbInfo getCbInfo;
  NapiGetBigIntUint64 getBigIntUint64;
  NapiGetBoolean getBoolean;
  NapiCreateUint32 createUint32;
  NapiCreateFunction createFunction;
  NapiSetNamedProperty setNamedProperty;
  NapiThrowError throwError;
  NapiGetUndefined getUndefined;
};

struct ForwardResult {
  bool targetFound;
  bool launched;
  DWORD exitCode;
};

NapiApi g_napi = {};
HookState g_hookState = {};

SRWLOCK g_hookLock = SRWLOCK_INIT;

LRESULT CALLBACK PrintScreenHookProc(int code, WPARAM wParam, LPARAM lParam);
LRESULT CALLBACK HookWndProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam);
DWORD WINAPI HookThreadProc(void*);
DWORD WINAPI ForwardThreadProc(void* param);
HMODULE GetCurrentModule();

FARPROC FindHostSymbol(const char* name) {
  HMODULE modules[] = {
    GetModuleHandleW(nullptr),
    GetModuleHandleW(L"electron.exe"),
    GetModuleHandleW(L"node.exe"),
    GetModuleHandleW(L"node.dll"),
  };

  for (int i = 0; i < static_cast<int>(sizeof(modules) / sizeof(modules[0])); i++) {
    if (modules[i] == nullptr) {
      continue;
    }

    FARPROC symbol = GetProcAddress(modules[i], name);
    if (symbol != nullptr) {
      return symbol;
    }
  }

  return nullptr;
}

template <typename T>
bool ResolveNapiSymbol(T* target, const char* name) {
  FARPROC symbol = FindHostSymbol(name);
  if (symbol == nullptr) {
    return false;
  }

  *target = reinterpret_cast<T>(symbol);
  return true;
}

bool ResolveNapi() {
  if (g_napi.resolved) {
    return g_napi.ok;
  }

  g_napi.resolved = true;
  g_napi.ok =
    ResolveNapiSymbol(&g_napi.getCbInfo, "napi_get_cb_info") &&
    ResolveNapiSymbol(&g_napi.getBigIntUint64, "napi_get_value_bigint_uint64") &&
    ResolveNapiSymbol(&g_napi.getBoolean, "napi_get_boolean") &&
    ResolveNapiSymbol(&g_napi.createUint32, "napi_create_uint32") &&
    ResolveNapiSymbol(&g_napi.createFunction, "napi_create_function") &&
    ResolveNapiSymbol(&g_napi.setNamedProperty, "napi_set_named_property") &&
    ResolveNapiSymbol(&g_napi.throwError, "napi_throw_error") &&
    ResolveNapiSymbol(&g_napi.getUndefined, "napi_get_undefined");

  return g_napi.ok;
}

napi_value Undefined(napi_env env) {
  napi_value result = nullptr;
  if (ResolveNapi()) {
    g_napi.getUndefined(env, &result);
  }
  return result;
}

napi_value ThrowError(napi_env env, const char* message) {
  if (ResolveNapi()) {
    g_napi.throwError(env, nullptr, message);
  }
  return Undefined(env);
}

bool GetWindowArg(napi_env env, napi_callback_info info, HWND* window) {
  napi_value args[1] = {};
  size_t argc = 1;
  if (g_napi.getCbInfo(env, info, &argc, args, nullptr, nullptr) != 0 || argc < 1) {
    return false;
  }

  unsigned __int64 windowValue = 0;
  bool lossless = false;
  if (g_napi.getBigIntUint64(env, args[0], &windowValue, &lossless) != 0 || !lossless ||
      windowValue == 0) {
    return false;
  }

  *window = reinterpret_cast<HWND>(static_cast<ULONG_PTR>(windowValue));
  return true;
}

napi_value BooleanValue(napi_env env, bool value) {
  napi_value result = nullptr;
  g_napi.getBoolean(env, value, &result);
  return result;
}

napi_value Uint32Value(napi_env env, UINT value) {
  napi_value result = nullptr;
  g_napi.createUint32(env, value, &result);
  return result;
}

void ClearMemory(void* buffer, SIZE_T size) {
  // no-CRT 构建下工具函数
  auto* bytes = static_cast<volatile unsigned char*>(buffer);
  for (SIZE_T i = 0; i < size; i++) {
    bytes[i] = 0;
  }
}

bool CopyString(wchar_t* target, DWORD targetLength, const wchar_t* source) {
  if (targetLength == 0) {
    return false;
  }

  DWORD index = 0;
  while (source[index] != L'\0') {
    if (index + 1 >= targetLength) {
      target[0] = L'\0';
      return false;
    }
    target[index] = source[index];
    index++;
  }

  target[index] = L'\0';
  return true;
}

bool AppendString(wchar_t* target, DWORD targetLength, DWORD* offset, const wchar_t* source) {
  while (*source != L'\0') {
    if (*offset + 1 >= targetLength) {
      return false;
    }
    target[*offset] = *source;
    (*offset)++;
    source++;
  }
  target[*offset] = L'\0';
  return true;
}

bool AppendLong(wchar_t* target, DWORD targetLength, DWORD* offset, LONG value) {
  wchar_t buffer[16];
  DWORD bufferOffset = 0;
  LONG remaining = value;
  bool negative = false;

  if (remaining < 0) {
    negative = true;
    remaining = -remaining;
  }

  do {
    if (bufferOffset >= static_cast<DWORD>(sizeof(buffer) / sizeof(buffer[0]))) {
      return false;
    }
    buffer[bufferOffset] = static_cast<wchar_t>(L'0' + (remaining % 10));
    remaining /= 10;
    bufferOffset++;
  } while (remaining > 0);

  if (negative && !AppendString(target, targetLength, offset, L"-")) {
    return false;
  }

  while (bufferOffset > 0) {
    bufferOffset--;
    if (*offset + 1 >= targetLength) {
      return false;
    }
    target[*offset] = buffer[bufferOffset];
    (*offset)++;
  }
  target[*offset] = L'\0';
  return true;
}

bool BuildHelperCommandLine(
  const wchar_t* helperPath,
  LONG x,
  LONG y,
  wchar_t* commandLine,
  DWORD commandLineLength
) {
  DWORD offset = 0;
  commandLine[0] = L'\0';
  return AppendString(commandLine, commandLineLength, &offset, L"\"") &&
         AppendString(commandLine, commandLineLength, &offset, helperPath) &&
         AppendString(commandLine, commandLineLength, &offset, L"\" --x ") &&
         AppendLong(commandLine, commandLineLength, &offset, x) &&
         AppendString(commandLine, commandLineLength, &offset, L" --y ") &&
         AppendLong(commandLine, commandLineLength, &offset, y);
}

bool GetCurrentSessionId(DWORD* sessionId) {
  return ProcessIdToSessionId(GetCurrentProcessId(), sessionId) != FALSE;
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

bool IsMediumNonElevatedToken(HANDLE token) {
  DWORD elevated = 1;
  DWORD integrityRid = 0;

  return GetTokenElevationFlag(token, &elevated) && elevated == 0 &&
         GetTokenIntegrityRid(token, &integrityRid) &&
         integrityRid == SECURITY_MANDATORY_MEDIUM_RID;
}

bool OpenExplorerToken(HANDLE* explorerToken) {
  DWORD currentSessionId = 0;
  if (!GetCurrentSessionId(&currentSessionId)) {
    return false;
  }

  // 复制当前 session 的普通权限 Explorer token; 未对 Explorer 做有副作用的操作
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return false;
  }

  PROCESSENTRY32W entry;
  ClearMemory(&entry, sizeof(entry));
  entry.dwSize = sizeof(entry);
  bool found = false;

  if (Process32FirstW(snapshot, &entry)) {
    do {
      if (lstrcmpiW(entry.szExeFile, L"explorer.exe") != 0) {
        continue;
      }

      DWORD processSessionId = 0;
      if (!ProcessIdToSessionId(entry.th32ProcessID, &processSessionId) ||
          processSessionId != currentSessionId) {
        continue;
      }

      HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, entry.th32ProcessID);
      if (process == nullptr) {
        continue;
      }

      HANDLE token = nullptr;
      const BOOL opened = OpenProcessToken(
        process,
        TOKEN_QUERY | TOKEN_DUPLICATE | TOKEN_ASSIGN_PRIMARY | TOKEN_ADJUST_DEFAULT |
          TOKEN_ADJUST_SESSIONID,
        &token
      );
      CloseHandle(process);
      if (!opened) {
        continue;
      }

      if (!IsMediumNonElevatedToken(token)) {
        CloseHandle(token);
        continue;
      }

      *explorerToken = token;
      found = true;
      break;
    } while (Process32NextW(snapshot, &entry));
  }

  CloseHandle(snapshot);
  return found;
}

bool DuplicatePrimaryToken(HANDLE token, HANDLE* primaryToken) {
  return DuplicateTokenEx(
           token,
           TOKEN_ASSIGN_PRIMARY | TOKEN_DUPLICATE | TOKEN_QUERY | TOKEN_ADJUST_DEFAULT |
             TOKEN_ADJUST_SESSIONID,
           nullptr,
           SecurityImpersonation,
           TokenPrimary,
           primaryToken
         ) != FALSE;
}

bool GetPrtScnHelperPath(wchar_t* helperPath, DWORD helperPathLength) {
  HMODULE module = GetCurrentModule();
  if (module == nullptr ||
      GetModuleFileNameW(module, helperPath, helperPathLength) == 0) {
    return false;
  }

  // helper 与 addon 同目录, 避免从 PATH 或外部输入解析可执行文件
  wchar_t* fileName = helperPath;
  for (wchar_t* current = helperPath; *current != L'\0'; current++) {
    if (*current == L'\\' || *current == L'/') {
      fileName = current + 1;
    }
  }

  return CopyString(fileName, static_cast<DWORD>(helperPath + helperPathLength - fileName), kPrtScnHelperFileName);
}

bool GetForwardPoint(HWND sourceWindow, LONG* x, LONG* y) {
  // helper 窗口放在 Sparkle 所在显示器, 避免多屏环境下焦点跳到其他屏
  HMONITOR monitor = MonitorFromWindow(sourceWindow, MONITOR_DEFAULTTONEAREST);
  if (monitor == nullptr) {
    return false;
  }

  MONITORINFO monitorInfo;
  ClearMemory(&monitorInfo, sizeof(monitorInfo));
  monitorInfo.cbSize = sizeof(monitorInfo);
  if (!GetMonitorInfoW(monitor, &monitorInfo)) {
    return false;
  }

  *x = monitorInfo.rcMonitor.left;
  *y = monitorInfo.rcMonitor.top;
  return true;
}

bool LaunchPrtScnHelper(
  HANDLE token,
  const wchar_t* helperPath,
  wchar_t* commandLine,
  PROCESS_INFORMATION* processInfo
) {
  STARTUPINFOW startupInfo;
  ClearMemory(&startupInfo, sizeof(startupInfo));
  startupInfo.cb = sizeof(startupInfo);
  startupInfo.lpDesktop = const_cast<wchar_t*>(L"winsta0\\default");
  ClearMemory(processInfo, sizeof(*processInfo));

  // 挂起启动后先允许 helper 设前台, 再恢复执行
  if (!CreateProcessWithTokenW(
        token,
        0,
        helperPath,
        commandLine,
        CREATE_NO_WINDOW | CREATE_SUSPENDED,
        nullptr,
        nullptr,
        &startupInfo,
        processInfo
      )) {
    return false;
  }

  AllowSetForegroundWindow(processInfo->dwProcessId);
  if (ResumeThread(processInfo->hThread) == static_cast<DWORD>(-1)) {
    TerminateProcess(processInfo->hProcess, 1);
    CloseHandle(processInfo->hThread);
    CloseHandle(processInfo->hProcess);
    ClearMemory(processInfo, sizeof(*processInfo));
    return false;
  }

  return true;
}

ForwardResult ForwardPrintScreen(HWND sourceWindow) {
  ForwardResult result = { false, false, 1 };
  if (sourceWindow == nullptr || !IsWindow(sourceWindow)) {
    return result;
  }

  wchar_t helperPath[MAX_PATH];
  if (!GetPrtScnHelperPath(helperPath, MAX_PATH) ||
      GetFileAttributesW(helperPath) == INVALID_FILE_ATTRIBUTES) {
    return result;
  }

  LONG x = 0;
  LONG y = 0;
  if (!GetForwardPoint(sourceWindow, &x, &y)) {
    return result;
  }

  HANDLE explorerToken = nullptr;
  if (!OpenExplorerToken(&explorerToken)) {
    return result;
  }

  HANDLE primaryToken = nullptr;
  if (!DuplicatePrimaryToken(explorerToken, &primaryToken)) {
    CloseHandle(explorerToken);
    return result;
  }

  result.targetFound = true;

  wchar_t commandLine[1024];
  if (!BuildHelperCommandLine(helperPath, x, y, commandLine, 1024)) {
    CloseHandle(primaryToken);
    CloseHandle(explorerToken);
    return result;
  }

  PROCESS_INFORMATION processInfo;
  if (!LaunchPrtScnHelper(primaryToken, helperPath, commandLine, &processInfo)) {
    CloseHandle(primaryToken);
    CloseHandle(explorerToken);
    return result;
  }

  result.launched = true;
  const DWORD waitResult = WaitForSingleObject(processInfo.hProcess, kForwardHelperTimeoutMs);
  if (waitResult == WAIT_OBJECT_0) {
    DWORD exitCode = 1;
    if (GetExitCodeProcess(processInfo.hProcess, &exitCode)) {
      result.exitCode = exitCode;
    }
  }

  CloseHandle(processInfo.hThread);
  CloseHandle(processInfo.hProcess);
  CloseHandle(primaryToken);
  CloseHandle(explorerToken);
  return result;
}

bool CanForwardPrintScreen(HWND sourceWindow) {
  // 没有可用普通权限 token 时, 不安装 hook, 保持系统 PrtScn 原行为
  // UAC "从不通知" 通常仍会保留 Medium Explorer token, 此时检查会通过
  // 若 Admin Approval Mode 被策略禁用, 内置 Administrator 直接使用 full token
  // 或 Explorer 被异常提权, 则检查失败
  if (sourceWindow == nullptr || !IsWindow(sourceWindow)) {
    return false;
  }

  wchar_t helperPath[MAX_PATH];
  if (!GetPrtScnHelperPath(helperPath, MAX_PATH) ||
      GetFileAttributesW(helperPath) == INVALID_FILE_ATTRIBUTES) {
    return false;
  }

  LONG x = 0;
  LONG y = 0;
  if (!GetForwardPoint(sourceWindow, &x, &y)) {
    return false;
  }

  HANDLE explorerToken = nullptr;
  if (!OpenExplorerToken(&explorerToken)) {
    return false;
  }

  HANDLE primaryToken = nullptr;
  const bool ok = DuplicatePrimaryToken(explorerToken, &primaryToken);
  if (primaryToken != nullptr) {
    CloseHandle(primaryToken);
  }
  CloseHandle(explorerToken);
  return ok;
}

UINT ToForwardStatus(const ForwardResult& result) {
  if (!result.targetFound) {
    return kForwardNoTarget;
  }
  if (!result.launched) {
    return kForwardFocusFailed;
  }
  if (result.exitCode != 0) {
    return kForwardSendFailed;
  }
  return kForwardSent;
}

void FinishForwardStatus(UINT status) {
  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.lastStatus = status;
  g_hookState.forwardCount++;
  g_hookState.forwarding = false;
  ReleaseSRWLockExclusive(&g_hookLock);
}

void RestoreWindowProc(HWND window, WNDPROC previousWndProc) {
  if (window != nullptr && previousWndProc != nullptr && IsWindow(window)) {
    SetWindowLongPtrW(window, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(previousWndProc));
  }
}

void RestoreWindowProc() {
  RestoreWindowProc(g_hookState.window, g_hookState.previousWndProc);
}

void ClearHookState() {
  g_hookState.window = nullptr;
  g_hookState.previousWndProc = nullptr;
  g_hookState.keyboardHook = nullptr;
  g_hookState.hookThread = nullptr;
  g_hookState.hookThreadId = 0;
  g_hookState.hookReadyEvent = nullptr;
  g_hookState.hookReady = false;
  g_hookState.hookInstalled = false;
  g_hookState.forwarding = false;
  g_hookState.suppressKeyUp = false;
}

void StopHookThread() {
  HANDLE hookThread = nullptr;
  DWORD hookThreadId = 0;
  HHOOK keyboardHook = nullptr;

  AcquireSRWLockExclusive(&g_hookLock);
  hookThread = g_hookState.hookThread;
  hookThreadId = g_hookState.hookThreadId;
  keyboardHook = g_hookState.keyboardHook;
  g_hookState.hookThread = nullptr;
  g_hookState.hookThreadId = 0;
  ReleaseSRWLockExclusive(&g_hookLock);

  if (hookThread == nullptr) {
    return;
  }

  if (hookThreadId != 0) {
    PostThreadMessageW(hookThreadId, WM_QUIT, 0, 0);
  }

  DWORD waitResult = WaitForSingleObject(hookThread, kHookThreadShutdownTimeoutMs);
  if (waitResult != WAIT_OBJECT_0 && keyboardHook != nullptr) {
    // 避免异常退出时残留全局 hook
    UnhookWindowsHookEx(keyboardHook);
    WaitForSingleObject(hookThread, kHookThreadShutdownTimeoutMs);
  }
  CloseHandle(hookThread);
}

void UninstallHookState() {
  HWND window = nullptr;
  WNDPROC previousWndProc = nullptr;

  StopHookThread();

  AcquireSRWLockExclusive(&g_hookLock);
  window = g_hookState.window;
  previousWndProc = g_hookState.previousWndProc;
  ClearHookState();
  ReleaseSRWLockExclusive(&g_hookLock);

  RestoreWindowProc(window, previousWndProc);
}

bool IsSourceForeground() {
  HWND source = nullptr;
  AcquireSRWLockShared(&g_hookLock);
  source = g_hookState.window;
  ReleaseSRWLockShared(&g_hookLock);

  HWND foreground = GetForegroundWindow();
  if (source == nullptr || foreground == nullptr || !IsWindow(source)) {
    return false;
  }

  if (foreground == source || IsChild(source, foreground)) {
    return true;
  }

  return GetAncestor(foreground, GA_ROOT) == source;
}

bool IsPlainModifierState() {
  const int modifiers[] = {
    VK_CONTROL,
    VK_LCONTROL,
    VK_RCONTROL,
    VK_MENU,
    VK_LMENU,
    VK_RMENU,
    VK_SHIFT,
    VK_LSHIFT,
    VK_RSHIFT,
    VK_LWIN,
    VK_RWIN,
  };

  for (int i = 0; i < static_cast<int>(sizeof(modifiers) / sizeof(modifiers[0])); i++) {
    if ((GetAsyncKeyState(modifiers[i]) & 0x8000) != 0) {
      return false;
    }
  }

  return true;
}

void ForwardFromWindowProc() {
  HWND window = nullptr;
  AcquireSRWLockShared(&g_hookLock);
  window = g_hookState.window;
  ReleaseSRWLockShared(&g_hookLock);

  if (window == nullptr || !IsWindow(window)) {
    FinishForwardStatus(kForwardNoTarget);
    return;
  }

  // 避免阻塞 Electron
  HANDLE thread = CreateThread(
    nullptr,
    0,
    ForwardThreadProc,
    reinterpret_cast<void*>(window),
    0,
    nullptr
  );
  if (thread == nullptr) {
    FinishForwardStatus(kForwardFocusFailed);
    return;
  }

  CloseHandle(thread);
}

LRESULT CallPreviousWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  WNDPROC previousWndProc = nullptr;
  AcquireSRWLockShared(&g_hookLock);
  previousWndProc = g_hookState.previousWndProc;
  ReleaseSRWLockShared(&g_hookLock);

  if (previousWndProc == nullptr) {
    return DefWindowProcW(window, message, wParam, lParam);
  }

  return CallWindowProcW(previousWndProc, window, message, wParam, lParam);
}

LRESULT CALLBACK HookWndProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  if (message == kForwardMessage) {
    ForwardFromWindowProc();
    return 0;
  }

  if (message == WM_NCDESTROY) {
    WNDPROC previousWndProc = nullptr;
    AcquireSRWLockShared(&g_hookLock);
    previousWndProc = g_hookState.previousWndProc;
    ReleaseSRWLockShared(&g_hookLock);

    StopHookThread();
    AcquireSRWLockExclusive(&g_hookLock);
    ClearHookState();
    ReleaseSRWLockExclusive(&g_hookLock);
    RestoreWindowProc(window, previousWndProc);
    if (previousWndProc != nullptr) {
      return CallWindowProcW(previousWndProc, window, message, wParam, lParam);
    }
  }

  return CallPreviousWindowProc(window, message, wParam, lParam);
}

bool IsPrtScnMessage(WPARAM wParam, LPARAM lParam) {
  const auto* info = reinterpret_cast<KBDLLHOOKSTRUCT*>(lParam);
  if (info == nullptr || info->vkCode != VK_SNAPSHOT) {
    return false;
  }

  if ((info->flags & LLKHF_INJECTED) != 0) {
    // helper 的 SendInput 会带 injected 标记, 必须忽略以避免递归
    return false;
  }

  return wParam == WM_KEYDOWN || wParam == WM_KEYUP || wParam == WM_SYSKEYDOWN ||
         wParam == WM_SYSKEYUP;
}

LRESULT CALLBACK PrintScreenHookProc(int code, WPARAM wParam, LPARAM lParam) {
  if (code < 0 || !IsPrtScnMessage(wParam, lParam)) {
    return CallNextHookEx(nullptr, code, wParam, lParam);
  }

  const bool isKeyDown = wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN;
  const bool isKeyUp = wParam == WM_KEYUP || wParam == WM_SYSKEYUP;

  AcquireSRWLockExclusive(&g_hookLock);
  if (isKeyUp && g_hookState.suppressKeyUp) {
    g_hookState.suppressKeyUp = false;
    ReleaseSRWLockExclusive(&g_hookLock);
    return 1;
  }
  ReleaseSRWLockExclusive(&g_hookLock);

  if (!isKeyDown || !IsPlainModifierState() || !IsSourceForeground()) {
    return CallNextHookEx(nullptr, code, wParam, lParam);
  }

  // 只捕获 Sparkle 前台时的裸 PrtScn, 组合键和其他前台应用保持原行为
  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.suppressKeyUp = true;
  if (!g_hookState.forwarding) {
    g_hookState.forwarding = true;
    HWND window = g_hookState.window;
    ReleaseSRWLockExclusive(&g_hookLock);

    if (!PostMessageW(window, kForwardMessage, 0, 0)) {
      AcquireSRWLockExclusive(&g_hookLock);
      g_hookState.lastStatus = kForwardPostFailed;
      g_hookState.forwardCount++;
      g_hookState.forwarding = false;
      ReleaseSRWLockExclusive(&g_hookLock);
    }
  } else {
    ReleaseSRWLockExclusive(&g_hookLock);
  }

  return 1;
}

DWORD WINAPI ForwardThreadProc(void* param) {
  HWND window = reinterpret_cast<HWND>(param);
  const UINT status = ToForwardStatus(ForwardPrintScreen(window));
  FinishForwardStatus(status);
  return 0;
}

HMODULE GetCurrentModule() {
  HMODULE module = nullptr;
  GetModuleHandleExW(
    GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
    reinterpret_cast<LPCWSTR>(&PrintScreenHookProc),
    &module
  );
  return module;
}

DWORD WINAPI HookThreadProc(void*) {
  SetThreadPriority(GetCurrentThread(), kHookThreadPriority);

  // WH_KEYBOARD_LL 的回调依赖安装线程持续泵消息; 独立线程避免影响 Electron 主线程
  MSG message;
  PeekMessageW(&message, nullptr, WM_USER, WM_USER, PM_NOREMOVE);

  HMODULE module = GetCurrentModule();
  HHOOK keyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, PrintScreenHookProc, module, 0);

  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.keyboardHook = keyboardHook;
  g_hookState.hookInstalled = keyboardHook != nullptr;
  g_hookState.hookReady = true;
  HANDLE readyEvent = g_hookState.hookReadyEvent;
  ReleaseSRWLockExclusive(&g_hookLock);

  if (readyEvent != nullptr) {
    SetEvent(readyEvent);
  }

  if (keyboardHook == nullptr) {
    return 0;
  }

  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }

  // 收到 WM_QUIT 后在安装线程内卸载 hook
  UnhookWindowsHookEx(keyboardHook);

  AcquireSRWLockExclusive(&g_hookLock);
  if (g_hookState.keyboardHook == keyboardHook) {
    g_hookState.keyboardHook = nullptr;
    g_hookState.hookInstalled = false;
  }
  ReleaseSRWLockExclusive(&g_hookLock);

  return 0;
}

bool InstallNativeHook(HWND window) {
  if (!IsWindow(window)) {
    return false;
  }

  UninstallHookState();

  HANDLE readyEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (readyEvent == nullptr) {
    return false;
  }

  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.window = window;
  g_hookState.hookReadyEvent = readyEvent;
  ReleaseSRWLockExclusive(&g_hookLock);

  SetLastError(0);
  WNDPROC previousWndProc = reinterpret_cast<WNDPROC>(
    SetWindowLongPtrW(window, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(HookWndProc))
  );
  if (previousWndProc == nullptr && GetLastError() != 0) {
    CloseHandle(readyEvent);
    AcquireSRWLockExclusive(&g_hookLock);
    ClearHookState();
    ReleaseSRWLockExclusive(&g_hookLock);
    return false;
  }

  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.previousWndProc = previousWndProc;
  ReleaseSRWLockExclusive(&g_hookLock);

  DWORD hookThreadId = 0;
  HANDLE hookThread = CreateThread(nullptr, 0, HookThreadProc, nullptr, 0, &hookThreadId);
  if (hookThread == nullptr) {
    CloseHandle(readyEvent);
    RestoreWindowProc(window, previousWndProc);
    AcquireSRWLockExclusive(&g_hookLock);
    ClearHookState();
    ReleaseSRWLockExclusive(&g_hookLock);
    return false;
  }

  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.hookThread = hookThread;
  g_hookState.hookThreadId = hookThreadId;
  ReleaseSRWLockExclusive(&g_hookLock);

  const DWORD waitResult = WaitForSingleObject(readyEvent, kHookThreadStartupTimeoutMs);
  CloseHandle(readyEvent);

  AcquireSRWLockExclusive(&g_hookLock);
  g_hookState.hookReadyEvent = nullptr;
  const bool ok = waitResult == WAIT_OBJECT_0 && g_hookState.hookInstalled;
  ReleaseSRWLockExclusive(&g_hookLock);

  if (!ok) {
    UninstallHookState();
  }

  return ok;
}

napi_value InstallHook(napi_env env, napi_callback_info info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  HWND window = nullptr;
  if (!GetWindowArg(env, info, &window)) {
    return ThrowError(env, "invalid installHook arguments");
  }

  return BooleanValue(env, InstallNativeHook(window));
}

napi_value UninstallHook(napi_env env, napi_callback_info info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  HWND window = nullptr;
  if (!GetWindowArg(env, info, &window)) {
    return ThrowError(env, "invalid uninstallHook arguments");
  }

  const bool ok = g_hookState.window == window;
  if (ok) {
    UninstallHookState();
  }
  return BooleanValue(env, ok);
}

napi_value ForwardPrtScn(napi_env env, napi_callback_info info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  HWND window = nullptr;
  if (!GetWindowArg(env, info, &window)) {
    return ThrowError(env, "invalid forwardPrtScn arguments");
  }

  return Uint32Value(env, ToForwardStatus(ForwardPrintScreen(window)));
}

napi_value CanForwardPrtScn(napi_env env, napi_callback_info info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  HWND window = nullptr;
  if (!GetWindowArg(env, info, &window)) {
    return ThrowError(env, "invalid canForwardPrtScn arguments");
  }

  return BooleanValue(env, CanForwardPrintScreen(window));
}

napi_value GetForwardCount(napi_env env, napi_callback_info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  AcquireSRWLockShared(&g_hookLock);
  const UINT count = g_hookState.forwardCount;
  ReleaseSRWLockShared(&g_hookLock);

  return Uint32Value(env, count);
}

napi_value GetLastStatus(napi_env env, napi_callback_info) {
  if (!ResolveNapi()) {
    return nullptr;
  }

  AcquireSRWLockShared(&g_hookLock);
  const UINT status = g_hookState.lastStatus;
  ReleaseSRWLockShared(&g_hookLock);

  return Uint32Value(env, status);
}

void SetFunction(napi_env env, napi_value exports, const char* name, napi_callback callback) {
  napi_value function = nullptr;
  if (g_napi.createFunction(env, name, static_cast<size_t>(-1), callback, nullptr, &function) == 0) {
    g_napi.setNamedProperty(env, exports, name, function);
  }
}

}

extern "C" __declspec(dllexport) int __cdecl node_api_module_get_api_version_v1() {
  return 6;
}

extern "C" __declspec(dllexport) napi_value __cdecl napi_register_module_v1(
  napi_env env,
  napi_value exports
) {
  if (!ResolveNapi()) {
    return exports;
  }

  SetFunction(env, exports, "installHook", InstallHook);
  SetFunction(env, exports, "uninstallHook", UninstallHook);
  SetFunction(env, exports, "forwardPrtScn", ForwardPrtScn);
  SetFunction(env, exports, "canForwardPrtScn", CanForwardPrtScn);
  SetFunction(env, exports, "getForwardCount", GetForwardCount);
  SetFunction(env, exports, "getLastStatus", GetLastStatus);
  return exports;
}
