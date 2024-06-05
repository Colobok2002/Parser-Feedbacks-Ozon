import { useEffect, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { store, persistor, useAppDispatch, useAppSelector } from "./store"
import { setWork } from "./feedbackSlice"
import { Switch } from "antd";

const RenderItem = ({ review, replyText, setReplyText }) => {
  return (
    <div key={review.uuid} style={{ border: "1px solid black", padding: "10px", margin: "10px" }}>
      <p>Product : {review.product.title}</p>
      <p>ProductId : {review.product.offer_id}</p>
      <p>UUID: {review.uuid}</p>
      <p>Rating: {review.rating}</p>
      <p>Positive: {review.text.positive}</p>
      <p>Negative: {review.text.negative}</p>
      <p>Comment: {review.text.comment}</p>
      <textarea
        value={replyText[review.uuid] || ""}
        onChange={(e) => setReplyText({ ...replyText, [review.uuid]: e.target.value })}
      />
    </div>
  )
}

const Popup = () => {

  const dispatch = useAppDispatch()
  const timer = useAppSelector((state) => state.feedback.timer);
  const data = useAppSelector((state) => state.feedback.feedback);
  const work = useAppSelector((state) => state.feedback.work);

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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          {work ? (
            <p style={{ fontSize: 14 }}>Включено</p>
          ) : (
            <p style={{ fontSize: 14 }}>Выключено</p>
          )}
          <Switch value={work} onChange={() => { dispatch(setWork(!work)) }}></Switch>
        </div>
        {work && (
          <>
            <p>Следующее обновление через -  {timer} секунд</p>
            <p>Необработано отзывов -  {data}</p>
          </>
        )}
      </div >
    );
  }

  return (
    <div>
      <p>Данный плагин работает только на <span onClick={handleRedirect} style={{ color: 'blue', cursor: 'pointer' }}>этой странице</span>.</p>
    </div>
  );
};

function IndexPopup() {
  return (
    <div style={{ height: 300, width: 300, background: "radial-gradient(139.34% 274.47% at 106.09% 320.4%,rgba(249,17,128,.15) 0,rgba(249,17,85,0) 100%),linear-gradient(339deg,rgba(223,198,255,.64),rgba(235,236,255,.23))", margin: -20 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <div style={{ margin: 20, padding: 10 }}>
            <h2>Feedbacks Markets</h2>
            <Popup />
          </div>
        </PersistGate>
      </Provider>
    </div>
  )
}

export default IndexPopup
