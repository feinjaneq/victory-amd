# The launcher's "Choose folder" button: a Windows folder dialog, and nothing else.
# Writes the picked path on one line; writes nothing when the dialog is cancelled.
param([string]$Title = 'Where is the game folder? (the one with the .exe)')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null

# A 1x1, invisible owner keeps the dialog in front of the launcher window and
# off the taskbar.
$owner = New-Object System.Windows.Forms.Form
$owner.Text = 'Retail Game'
$owner.FormBorderStyle = 'None'
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Opacity = 0
$owner.Show()

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = $Title
$dialog.ShowNewFolderButton = $false

try {
    if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::Out.WriteLine($dialog.SelectedPath)
    }
} finally {
    $dialog.Dispose()
    $owner.Close()
    $owner.Dispose()
}
