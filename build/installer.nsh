!ifndef BUILD_UNINSTALLER

!macro customHeader
  Var sparkleServiceWasRunning
!macroend

!macro ServiceOutputContains NEEDLE RESULT
  StrCpy ${RESULT} "false"
  StrCpy $R5 0
  StrLen $R6 $R3
  StrLen $R8 "${NEEDLE}"
  ${Do}
    StrCpy $R9 $R3 $R8 $R5
    ${If} $R9 == "${NEEDLE}"
      StrCpy ${RESULT} "true"
      ${Break}
    ${EndIf}
    IntOp $R5 $R5 + 1
  ${LoopUntil} $R5 >= $R6
!macroend

!macro QuerySparkleServiceState RESULT
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query SparkleService'
  Pop $R2
  Pop $R3

  StrCpy ${RESULT} "not-installed"
  ${If} $R2 == 0
    !insertmacro ServiceOutputContains "RUNNING" $R4
    ${If} $R4 == "true"
      StrCpy ${RESULT} "running"
    ${Else}
      !insertmacro ServiceOutputContains "STOP_PENDING" $R4
      ${If} $R4 == "true"
        StrCpy ${RESULT} "stop-pending"
      ${Else}
        !insertmacro ServiceOutputContains "STOPPED" $R4
        ${If} $R4 == "true"
          StrCpy ${RESULT} "stopped"
        ${Else}
          StrCpy ${RESULT} "unknown"
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro WaitSparkleServiceStopped
  StrCpy $R0 0
  ${Do}
    !insertmacro QuerySparkleServiceState $R1
    ${If} $R1 == "stopped"
    ${OrIf} $R1 == "not-installed"
      ${Break}
    ${EndIf}
    Sleep 500
    IntOp $R0 $R0 + 1
  ${LoopUntil} $R0 >= 30

  !insertmacro QuerySparkleServiceState $R1
  ${If} $R1 != "stopped"
  ${AndIf} $R1 != "not-installed"
    MessageBox MB_ICONSTOP "SparkleService is still running. Please stop the service and run the installer again."
    Abort
  ${EndIf}
!macroend

!macro DisableSysProxy
  StrCpy $R1 "$INSTDIR\resources\files\sparkle-service.exe"
  ${If} ${FileExists} "$R1"
    DetailPrint "Disabling system proxy: $R1"
    nsExec::ExecToLog '"$R1" sysproxy disable'
    Pop $R2
    ${If} $R2 != 0
      DetailPrint "Disable system proxy exited with code $R2"
    ${EndIf}
  ${EndIf}
!macroend

!macro StopSparkleServiceIfRunning
  !insertmacro QuerySparkleServiceState $R1

  ${If} $R1 != "stopped"
  ${AndIf} $R1 != "not-installed"
    StrCpy $sparkleServiceWasRunning "true"
    DetailPrint "Stopping Sparkle service"
    nsExec::ExecToStack '"$SYSDIR\sc.exe" stop SparkleService'
    Pop $R2
    Pop $R3
    !insertmacro WaitSparkleServiceStopped
    !insertmacro DisableSysProxy
  ${EndIf}
!macroend

!macro customInit
  StrCpy $sparkleServiceWasRunning "false"
  !insertmacro StopSparkleServiceIfRunning
!macroend

!macro customInstall
  ${ifNot} ${isUpdated}
    CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  ${endIf}

  ${If} $sparkleServiceWasRunning == "true"
    StrCpy $R1 "$INSTDIR\resources\files\sparkle-service.exe"
    ${If} ${FileExists} "$R1"
      DetailPrint "Starting Sparkle service: $R1"
      nsExec::ExecToLog '"$R1" service start'
      Pop $R2
      ${If} $R2 != 0
        DetailPrint "Sparkle service start exited with code $R2"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!endif
