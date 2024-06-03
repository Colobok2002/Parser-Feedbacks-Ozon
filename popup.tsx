import React, { useEffect, useState } from "react";

const Popup = () => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const queryInfo = { active: true, currentWindow: true };

    chrome.tabs.query(queryInfo, (tabs) => {
      const tab = tabs[0];
      setUrl(tab.url);
    });
  }, []);

  const handleRedirect = () => {
    chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
  };

  if (url.includes("https://seller.ozon.ru/app")) {
    return (
      <div>
        <p>Current URL: {url}</p>
      </div>
    );
  }

  return (
    <div>
      <p>Данный плагин работает только на <div onClick={handleRedirect}>этой странице</div>.</p>
    </div>
  );
};

export default Popup;
