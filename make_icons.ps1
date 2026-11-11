$iconSvg16 = @"
<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
  <rect width='16' height='16' rx='3' fill='#1a56db'/>
  <text x='8' y='12' font-size='10' text-anchor='middle' fill='white' font-family='Arial'>J</text>
</svg>
"@

$iconSvg48 = @"
<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
  <rect width='48' height='48' rx='8' fill='url(#g)'/>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#1a56db'/>
      <stop offset='100%' stop-color='#0d9488'/>
    </linearGradient>
  </defs>
  <rect x='10' y='8' width='28' height='4' rx='2' fill='white' opacity='0.9'/>
  <rect x='10' y='16' width='22' height='4' rx='2' fill='white' opacity='0.9'/>
  <rect x='10' y='24' width='25' height='4' rx='2' fill='white' opacity='0.9'/>
  <rect x='10' y='32' width='18' height='4' rx='2' fill='white' opacity='0.9'/>
  <circle cx='38' cy='38' r='8' fill='#10b981'/>
  <text x='38' y='42' font-size='10' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>✓</text>
</svg>
"@

$iconSvg128 = @"
<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
  <rect width='128' height='128' rx='20' fill='url(#g2)'/>
  <defs>
    <linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#1a56db'/>
      <stop offset='100%' stop-color='#0d9488'/>
    </linearGradient>
  </defs>
  <rect x='24' y='20' width='70' height='10' rx='5' fill='white' opacity='0.9'/>
  <rect x='24' y='40' width='55' height='10' rx='5' fill='white' opacity='0.9'/>
  <rect x='24' y='60' width='65' height='10' rx='5' fill='white' opacity='0.9'/>
  <rect x='24' y='80' width='45' height='10' rx='5' fill='white' opacity='0.9'/>
  <circle cx='98' cy='98' r='22' fill='#10b981'/>
  <text x='98' y='106' font-size='26' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>✓</text>
</svg>
"@

# Save SVG files
$iconSvg16  | Out-File -FilePath "C:\Users\mahfu\AppData\Local\Temp\JobFormFiller\icons\icon16.svg"  -Encoding UTF8
$iconSvg48  | Out-File -FilePath "C:\Users\mahfu\AppData\Local\Temp\JobFormFiller\icons\icon48.svg"  -Encoding UTF8
$iconSvg128 | Out-File -FilePath "C:\Users\mahfu\AppData\Local\Temp\JobFormFiller\icons\icon128.svg" -Encoding UTF8

echo "SVG icons saved"
