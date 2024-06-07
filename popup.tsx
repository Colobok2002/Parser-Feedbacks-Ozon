import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "@plasmohq/redux-persist/integration/react";
import { store, persistor, useAppDispatch, useAppSelector } from "./store";
import { setWork } from "./feedbackSlice";
import { Tabs, Switch, Input, Button, Form, Typography } from "antd";

const { TabPane } = Tabs;
const { Text } = Typography;

const Popup = () => {
  const dispatch = useAppDispatch();
  const timer = useAppSelector((state) => state.feedback.timer);
  const data = useAppSelector((state) => state.feedback.feedback);
  const work = useAppSelector((state) => state.feedback.work);

  const [url, setUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [apiUrlError, setApiUrlError] = useState("");
  const [companyIdError, setCompanyIdError] = useState("");

  useEffect(() => {
    const queryInfo = { active: true, currentWindow: true };
    chrome.tabs.query(queryInfo, (tabs) => {
      const tab = tabs[0];
      setUrl(tab.url);
    });

    const savedApiUrl = localStorage.getItem("ApiUrl");
    const savedCompanyId = localStorage.getItem("company_id");
    if (savedApiUrl) {
      setApiUrl(savedApiUrl);
    }
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
    }
  }, []);

  const validateApiUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch (e) {
      return false;
    }
  };

  const validateCompanyId = (id) => {
    return /^\d+$/.test(id);
  };

  const handleSaveSettings = () => {
    let valid = true;

    if (!validateApiUrl(apiUrl)) {
      setApiUrlError("Введите корректный URL");
      valid = false;
    } else {
      let cleanedApiUrl = apiUrl;
      if (apiUrl.endsWith("/")) {
        cleanedApiUrl = apiUrl.slice(0, -1);
      }
      setApiUrl(cleanedApiUrl);
      setApiUrlError("");
    }

    if (!validateCompanyId(companyId)) {
      setCompanyIdError("Company ID должно состоять только из чисел");
      valid = false;
    } else {
      setCompanyIdError("");
    }

    if (valid) {
      localStorage.setItem("ApiUrl", apiUrl);
      localStorage.setItem("company_id", companyId);
      alert("Settings saved");
    }
  };

  const handleRedirect = () => {
    chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
  };

  return (
    <Tabs defaultActiveKey="1">
      <TabPane tab="Работа" key="1">
        {url.includes("https://seller.ozon.ru/app") ? (
          <>
            {url.includes("registration") ? (
              <Text>Для работы плагина необходимо авторизоваться</Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                {apiUrl && companyId ? (
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 14 }}>{work ? "Включено" : "Выключено"}</Text>
                    <Switch checked={work} onChange={() => { dispatch(setWork(!work)) }} />
                  </div>
                ) : (
                  <Text>Для работы плагина выполните настройку</Text>
                )}
                {work && (
                  <>
                    <Text>Следующее обновление через - {timer} секунд</Text>
                    <Text>Необработано отзывов - {data}</Text>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <Text>Данный плагин работает только на <a onClick={handleRedirect} style={{ color: 'blue', cursor: 'pointer' }}>этой странице</a>.</Text>
          </div>
        )}
      </TabPane>
      <TabPane tab="Настройки" key="2">
        <Form layout="vertical" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Form.Item label="ApiUrl" validateStatus={apiUrlError ? "error" : ""} help={apiUrlError}>
            <Input
              placeholder="ApiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Company ID" validateStatus={companyIdError ? "error" : ""} help={companyIdError}>
            <Input
              placeholder="Company ID"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleSaveSettings}>Сохранить</Button>
          </Form.Item>
        </Form>
      </TabPane>
    </Tabs>
  );
};

function IndexPopup() {
  return (
    <div style={{ width: 300, background: "radial-gradient(139.34% 274.47% at 106.09% 320.4%,rgba(249,17,128,.15) 0,rgba(249,17,85,0) 100%),linear-gradient(339deg,rgba(223,198,255,.64),rgba(235,236,255,.23))", margin: -20 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <div style={{ margin: 20, padding: 10 }}>
            <h2>Feedbacks Ozon Answer</h2>
            <Popup />
          </div>
        </PersistGate>
      </Provider>
    </div>
  );
}

export default IndexPopup;
