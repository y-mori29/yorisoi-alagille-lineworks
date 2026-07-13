$ErrorActionPreference = 'Stop'

$projectDir = 'C:\Users\green\Projects\medicanvas\yorisoi\patient\yorisoi-alagille-lineworks\images\alagille-avatar-set-20260712'
$referenceImage = 'C:\Users\green\Projects\.codex\skills\gentle-watercolor-asset-style\assets\reference-images\alagille-family-medical-asset-sheet-v1.png'
$prompt = @'
prompts/01_adult_man.md, prompts/02_adult_woman.md, prompts/03_child_boy.md, prompts/04_child_girl.md を順に読み、参照画像のやさしい水彩トーンを厳密に保って、内蔵 image_gen ツールで各1枚ずつ生成してください。SVG/HTML/Python/PIL/PowerShellによる描画は禁止です。各mdの target_asset 名で output/ にPNG保存してください。4枚は同じ構図・縮尺・余白・水彩密度に揃えてください。
'@

& codex exec $prompt --sandbox workspace-write --cd $projectDir --image $referenceImage
exit $LASTEXITCODE
