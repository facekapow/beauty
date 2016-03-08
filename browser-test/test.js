'use strict';

(function() {
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function() {
    if (xhr.readyState === 4) {
      beauty.parse(xhr.responseText, 'test.beau');
    }
  });
  xhr.open('GET', 'test.beau');
  xhr.send();
})();
