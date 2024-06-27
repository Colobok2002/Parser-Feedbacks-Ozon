import { useEffect, useState } from "react";
import { Tabs, Switch, Input, Button, Form, Typography, message } from "antd";
import axios from "axios";

const { TabPane } = Tabs;
const { Text } = Typography;

const Popup = () => {
  const [url, setUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [headerApiKey, setHeaderApiKey] = useState("");
  const [apiUrlError, setApiUrlError] = useState("");
  const [companyIdError, setCompanyIdError] = useState("");
  const [work, setWork] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState(0);
  const [questions, setQuestions] = useState(0);
  const [interval, setInterval] = useState(60);  // Добавляем состояние для интервала
  const [intervalError, setIntervalError] = useState("");

  useEffect(() => {
    const queryInfo = { active: true, currentWindow: true };
    chrome.tabs.query(queryInfo, (tabs) => {
      const tab = tabs[0];
      setUrl(tab.url);
    });

    chrome.storage.local.get(["ApiUrl", "company_id", "HeaderApiKey", "work", "timer", "feedback", "questions", "interval"], (result) => {
      if (result.ApiUrl) setApiUrl(result.ApiUrl);
      if (result.company_id) setCompanyId(result.company_id);
      if (result.HeaderApiKey) setHeaderApiKey(result.HeaderApiKey);
      if (result.work !== undefined) setWork(result.work);
      if (result.timer !== undefined) setTimer(result.timer);
      if (result.feedback !== undefined) setFeedback(result.feedback);
      if (result.questions !== undefined) setQuestions(result.questions);
      if (result.interval !== undefined) setInterval(result.interval);
    });

    const handleStorageChange = (changes, areaName) => {
      if (areaName === "local") {
        if (changes.timer) {
          setTimer(changes.timer.newValue);
        }
        if (changes.feedback) {
          setFeedback(changes.feedback.newValue);
        }
        if (changes.work) {
          setWork(changes.work.newValue);
        }
        if (changes.interval) {
          setInterval(changes.interval.newValue);
        }
        if (changes.questions) {
          setQuestions(changes.questions.newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
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

  const validateInterval = (value) => {
    const parsedValue = parseInt(value, 10);
    if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 60 * 20) {
      return true;
    } else {
      return false;
    }
  };

  const handleIntervalChange = (value) => {
    if (validateInterval(value)) {
      setIntervalError("");
      setInterval(parseInt(value, 10));
    } else {
      setIntervalError("Интервал должен быть числом от 10 до 1200");
    }
  };

  const handleSaveSettings = async () => {
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

    if (!validateInterval(interval.toString())) {
      setIntervalError("Интервал должен быть числом от 10 до 1200");
      valid = false;
    } else {
      setIntervalError("");
    }

    if (valid) {
      try {
        const response = await axios.get(`${apiUrl}/feedbacks/chek-ozon-plagin-settings`, {
          headers: {
            "HeaderApiKey": headerApiKey,
          },
        });
        if (response.status === 200 && response.data.status) {
          chrome.storage.local.set({
            ApiUrl: apiUrl,
            company_id: companyId,
            HeaderApiKey: headerApiKey,
            interval
          }, () => {
            message.success("Настройки сохранены");
          });
        } else {
          message.error("Ошибка при проверке настроек");
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          message.error("Неверный токен");
        } else {
          message.error(`Ошибка при проверке настроек: ${error.message}`);
        }
      }
    }
  };

  const handleSwitchWork = () => {
    const newWorkState = !work;
    setWork(newWorkState);
    chrome.storage.local.set({ work: newWorkState });
  };

  const handleRedirect = () => {
    chrome.tabs.create({ url: "https://seller.ozon.ru/app" });
  };

  const formatSecondsToMMSS = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <div style={{ width: 300, background: "radial-gradient(139.34% 274.47% at 106.09% 320.4%,rgba(249,17,128,.15) 0,rgba(249,17,85,0) 100%),linear-gradient(339deg,rgba(223,198,255,.64),rgba(235,236,255,.23))", margin: -20 }}>
      <div style={{ margin: 20, padding: 10 }}>
        <h2>Feedbacks Ozon Answer</h2>
        <Tabs defaultActiveKey="1">
          <TabPane tab="Работа" key="1">
            {url.includes("https://seller.ozon.ru/app") ? (
              <>
                {url.includes("registration") ? (
                  <Text>Для работы плагина необходимо авторизоваться</Text>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                    {apiUrl && companyId && headerApiKey ? (
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 14 }}>{work ? "Включено" : "Выключено"}</Text>
                        <Switch checked={work} onChange={handleSwitchWork} />
                      </div>
                    ) : (
                      <Text>Для работы плагина выполните настройку</Text>
                    )}
                    {work && (
                      <>
                        <Text>Следующее обновление через - {formatSecondsToMMSS(timer)}</Text>
                        <Text>Необработано отзывов - {feedback}</Text>
                        <Text>Необработано вопросов - {questions}</Text>
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
              <Form.Item label="Header Api Key">
                <Input
                  placeholder="Header Api Key"
                  value={headerApiKey}
                  onChange={(e) => setHeaderApiKey(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Интервал (в секундах)" validateStatus={intervalError ? "error" : ""} help={intervalError}>
                <Input
                  placeholder="Интервал"
                  value={interval.toString()}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" style={{ flex: 1, width: "100%" }} onClick={handleSaveSettings}>Сохранить</Button>
              </Form.Item>
            </Form>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3 }}>
              <p>version 0.2.1</p>
            </div>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default Popup;
