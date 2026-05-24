// feedback-toast.js
document.addEventListener("DOMContentLoaded", () => {
  const toast = document.getElementById("feedbackToast");
  const closeBtn = document.getElementById("closeToastBtn");
  const feedbackBtn = document.getElementById("toastFeedbackBtn");


  // --- Function to check if user is near comments section ---
  const isNearComments = () => {
    const anchor = document.getElementById("comments-anchor") || document.getElementById("knowyouremi-comments");
    if (!anchor) return false;
    const rect = anchor.getBoundingClientRect();
    return rect.top < window.innerHeight + 200;
  };

  // --- Function to show toast ---
  const showToast = () => {
    if (isNearComments()) return;
    toast.classList.remove("hidden", "hide");
    toast.classList.add("show");
    
    // Auto-hide after 12 seconds
    setTimeout(() => {
      toast.classList.add("hide");
      setTimeout(() => toast.classList.add("hidden"), 500);
    }, 12000);
  };

  // --- Triggers ---
  // Show after 30 seconds
const toastInterval = setInterval(showToast, 60000);

  // Show after scrolling 70%
  // window.addEventListener("scroll", () => {
  //   const scrollPos = window.scrollY + window.innerHeight;
  //   const docHeight = document.body.offsetHeight;
  //   if ((scrollPos / docHeight) > 0.7) showToast();
  // });

  // --- Close manually ---
  closeBtn.addEventListener("click", () => {
    toast.classList.add("hide");
    setTimeout(() => toast.classList.add("hidden"), 500);
  });

  // --- Smooth scroll to feedback form ---
  feedbackBtn.addEventListener("click", () => {
    const feedbackForm = document.querySelector("#feedback-section");
    if (feedbackForm) {
      feedbackForm.scrollIntoView({ behavior: "smooth" });
      clearInterval(toastInterval)
    }
    toast.classList.add("hide");
    setTimeout(() => toast.classList.add("hidden"), 500);
  });
});
