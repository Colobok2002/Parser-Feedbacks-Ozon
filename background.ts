import axios from "axios";

let timer_count = 5;

const checkAllProcessed = (data) => {
  return data.every(item => item.interaction_status === 'PROCESSED');
};

const getCookies = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({}, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        resolve(cookieString);
      }
    });
  });
};


const getFeedback = async () => {
  try {
    const cookies = await getCookies();
    let allProcessed = false;
    let pagination_last_timestamp = null;
    let pagination_last_uuid = null;
    let allReviews = [];
    let unprocessedReviews = [];

    while (!allProcessed) {
      const response = await fetch("https://seller.ozon.ru/api/v3/review/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies
        },
        body: JSON.stringify({
          "with_counters": false,
          "sort": { "sort_by": "PUBLISHED_AT", "sort_direction": "DESC" },
          "company_type": "seller",
          "filter": { "interaction_status": ["ALL"] },
          "company_id": "27844",
          "pagination_last_timestamp": pagination_last_timestamp,
          "pagination_last_uuid": pagination_last_uuid
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allReviews = [...allReviews, ...data.result];

      const newUnprocessed = data.result.filter(item => item.interaction_status !== 'PROCESSED');
      unprocessedReviews = [...unprocessedReviews, ...newUnprocessed];

      if (checkAllProcessed(data.result)) {
        allProcessed = true;
      } else {
        pagination_last_timestamp = data.pagination_last_timestamp;
        pagination_last_uuid = data.pagination_last_uuid;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(unprocessedReviews);
  } catch (error) {
    alert(error);
  }
};




setInterval(() => {
 getFeedback()
}, timer_count * 1000);