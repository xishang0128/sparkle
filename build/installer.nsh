!ifndef BUILD_UNINSTALLER

!macro customHeader
  Var sparkleServiceWasRunning
!macroend

!macro StopSparkleServiceIfRunning
  nsExec::ExecToStack '"$SYSDIR\sc.exe" query SparkleService'
  Pop $R2
  Pop $R3

  StrCpy $R4 "false"
  StrCpy $R5 0
  StrLen $R6 $R3
  ${Do}
    StrCpy $R7 $R3 7 $R5
    ${If} $R7 == "RUNNING"
      StrCpy $R4 "true"
      ${Break}
    ${EndIf}
    IntOp $R5 $R5 + 1
  ${LoopUntil} $R5 >= $R6

  ${If} $R4 == "true"
    StrCpy $sparkleServiceWasRunning "true"
    DetailPrint "Stopping Sparkle service"
    nsExec::ExecToLog '"$SYSDIR\sc.exe" stop SparkleService'
    Sleep 3000
  ${EndIf}
!macroend

!macro customInit
  StrCpy $sparkleServiceWasRunning "false"
  !insertmacro StopSparkleServiceIfRunning
!macroend

!macro customInstall
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
