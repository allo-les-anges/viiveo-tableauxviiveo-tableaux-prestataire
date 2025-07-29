export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const specialite = url.searchParams.get("specialite");

    if (type === "dropdown" && specialite) {
      const response = await fetch("https://script.google.com/macros/s/AKfycbzEEZZnZJK1BEXlCk81ogi0Aa7MFGunOkjS5s2CCDIZPSkHq0OtPAcEBLrkXp-fpb8aaQ/exec?type=dropdown&specialite=" + encodeURIComponent(specialite));
      const data = await response.text();

      return new Response(data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Paramètres manquants ou incorrects", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
