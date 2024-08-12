// content.ts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchData') {
    console.log(123)
    console.log(request.url)
    fetch(request.url, request.options)
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    // Возвращаем true, чтобы указать, что ответ будет асинхронным
    return true;
  }
});


