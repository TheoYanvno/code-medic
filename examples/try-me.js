// Open this file with Code Medic running: every line below has something to fix.
// Hover over a squiggle for the reason, press Ctrl+. for two fixes,
// or run "Code Medic: Fix all safe issues in this file".

var total = 0;

function addAll(values) {
  for (var i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    total += parseInt(values[i]);
  }
  console.log('total is', total);
  return total;
}

if (addAll(['1', '2', '3']) != 6) { debugger; }
