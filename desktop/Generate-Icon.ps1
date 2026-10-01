param([string]$Output = (Join-Path $PSScriptRoot '..\.tools\card-vault.ico'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
# The same four-point sparkle used by the Card Vault wordmark, rendered at icon sizes.
$stream = [IO.File]::Create($Output)
$writer = New-Object IO.BinaryWriter($stream)
$sizes = @(16,24,32,48,64,128,256)
$images = @()
foreach ($size in $sizes) {
    $bmp = New-Object Drawing.Bitmap($size,$size)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([Drawing.Color]::FromArgb(38,65,49))
    $points = @([Drawing.PointF]::new($size*.5,$size*.13),[Drawing.PointF]::new($size*.61,$size*.39),[Drawing.PointF]::new($size*.87,$size*.5),[Drawing.PointF]::new($size*.61,$size*.61),[Drawing.PointF]::new($size*.5,$size*.87),[Drawing.PointF]::new($size*.39,$size*.61),[Drawing.PointF]::new($size*.13,$size*.5),[Drawing.PointF]::new($size*.39,$size*.39))
    $brush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(222,236,183))
    $g.FillPolygon($brush,[Drawing.PointF[]]$points)
    $mem = New-Object IO.MemoryStream
    $bmp.Save($mem,[Drawing.Imaging.ImageFormat]::Png)
    $images += ,$mem.ToArray()
    $mem.Dispose(); $brush.Dispose(); $g.Dispose(); $bmp.Dispose()
}
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16*$sizes.Count
for ($i=0;$i -lt $sizes.Count;$i++) {
    $dim = if ($sizes[$i] -eq 256) {0} else {$sizes[$i]}
    $writer.Write([byte]$dim); $writer.Write([byte]$dim); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
    $offset += $images[$i].Length
}
foreach ($bytes in $images) {$writer.Write([byte[]]$bytes)}
$writer.Dispose(); $stream.Dispose()
