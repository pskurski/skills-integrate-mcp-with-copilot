document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("search-activities");
  const categoryFilter = document.getElementById("filter-category");
  const sortSelect = document.getElementById("sort-activities");

  let allActivities = {};

  const dayOrder = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };

  function parseStartTime(schedule) {
    const lowerSchedule = schedule.toLowerCase();
    const matchingDay = Object.keys(dayOrder).find((day) =>
      lowerSchedule.includes(day)
    );
    const dayRank = matchingDay ? dayOrder[matchingDay] : 99;

    const timeMatch = schedule.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
      return { dayRank, minuteOfDay: 24 * 60 };
    }

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }
    if (period === "AM" && hour === 12) {
      hour = 0;
    }

    return { dayRank, minuteOfDay: hour * 60 + minute };
  }

  function getFilteredAndSortedActivities(activities) {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortBy = sortSelect.value;

    const entries = Object.entries(activities).filter(([name, details]) => {
      const category = details.category || "General";
      const matchesCategory =
        selectedCategory === "all" || category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchText = [
        name,
        details.description,
        details.schedule,
        category,
      ]
        .join(" ")
        .toLowerCase();

      return searchText.includes(searchTerm);
    });

    entries.sort((a, b) => {
      const [nameA, detailsA] = a;
      const [nameB, detailsB] = b;

      if (sortBy === "spots") {
        const spotsA = detailsA.max_participants - detailsA.participants.length;
        const spotsB = detailsB.max_participants - detailsB.participants.length;
        if (spotsA !== spotsB) {
          return spotsB - spotsA;
        }
      }

      if (sortBy === "time") {
        const timeA = parseStartTime(detailsA.schedule);
        const timeB = parseStartTime(detailsB.schedule);
        if (timeA.dayRank !== timeB.dayRank) {
          return timeA.dayRank - timeB.dayRank;
        }
        if (timeA.minuteOfDay !== timeB.minuteOfDay) {
          return timeA.minuteOfDay - timeB.minuteOfDay;
        }
      }

      return nameA.localeCompare(nameB);
    });

    return entries;
  }

  function renderActivities() {
    activitiesList.innerHTML = "";
    const entries = getFilteredAndSortedActivities(allActivities);

    if (entries.length === 0) {
      activitiesList.innerHTML =
        "<p>No activities match your current filters.</p>";
      return;
    }

    entries.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const category = details.category || "General";

      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p class="activity-meta"><span class="category-badge">${category}</span></p>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  function populateSignupOptions(activities) {
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    Object.keys(activities)
      .sort((a, b) => a.localeCompare(b))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
  }

  function populateCategoryFilter(activities) {
    const categoryOptions = new Set(["all"]);

    Object.values(activities).forEach((details) => {
      categoryOptions.add(details.category || "General");
    });

    const selected = categoryFilter.value || "all";
    categoryFilter.innerHTML = "";

    Array.from(categoryOptions).forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category === "all" ? "All categories" : category;
      categoryFilter.appendChild(option);
    });

    if (categoryOptions.has(selected)) {
      categoryFilter.value = selected;
    } else {
      categoryFilter.value = "all";
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      allActivities = await response.json();

      populateSignupOptions(allActivities);
      populateCategoryFilter(allActivities);
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  searchInput.addEventListener("input", renderActivities);
  categoryFilter.addEventListener("change", renderActivities);
  sortSelect.addEventListener("change", renderActivities);

  // Initialize app
  fetchActivities();
});
