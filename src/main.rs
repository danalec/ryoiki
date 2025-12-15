pub mod metrics_calc;
pub mod scan;

use axum::{
    Router,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::post,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    rt.block_on(async_main())
}

async fn async_main() -> Result<(), Box<dyn std::error::Error>> {
    // Serve static files from apps/web/public/ryoiki.cc.json if requested directly?
    // Vite handles static files in dev.
    // In prod, we might want to serve .

    let app = Router::new()
        .route("/api/refresh", post(refresh_handler))
        .fallback_service(ServeDir::new("apps/web/dist"))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3030));
    println!("Ryoiki server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn refresh_handler() -> impl IntoResponse {
    println!("Refresh requested");
    match scan::run_scan() {
        Ok(json) => {
            println!("Scan completed successfully");
            // Return the JSON object
            match serde_json::from_str::<serde_json::Value>(&json) {
                Ok(v) => (StatusCode::OK, Json(v)),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    #[allow(clippy::disallowed_methods)]
                    Json(serde_json::json!({ "error": format!("Invalid JSON generated: {}", e) })),
                ),
            }
        }
        Err(e) => {
            eprintln!("Scan failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                #[allow(clippy::disallowed_methods)]
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        }
    }
}
