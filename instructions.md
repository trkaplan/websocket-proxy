WebSocket REST API Proxy Projesi Geliştirme Talimatları
Proje Amacı
Bu proje, şirket ağı içindeki (proxy arkasındaki) bir REST API'ye dışarıdan (örneğin bir Mac bilgisayardan) erişim sağlamak için WebSocket tabanlı bir proxy çözümü oluşturmayı amaçlamaktadır.
Genel Mimari
Sistem iki ana bileşenden oluşur:

Vercel WebSocket Sunucusu: Dış dünyadan gelen API isteklerini karşılayan ve bunları WebSocket üzerinden bağlı istemcilere ileten bir Node.js uygulaması.
Remote Desktop WebSocket İstemcisi: Şirket ağı içindeki bir Windows Remote Desktop makinesinde çalışan, Vercel sunucusuna bağlanan ve istekleri içerideki 8081 portundaki REST API'ye ileten bir Node.js uygulaması.

Klasör Yapısı
Projeyi şu klasör yapısı ile organize edin:
/websocket-proxy/
├── /server/             # Vercel'e deploy edilecek sunucu
│   ├── server.js        # Ana sunucu kodu
│   ├── package.json     # Bağımlılıklar ve script tanımları
│   └── vercel.json      # Vercel yapılandırması
│
├── /client/             # Remote Desktop'ta çalışacak istemci
│   ├── client.js        # İstemci kodu
│   └── package.json     # Bağımlılıklar ve script tanımları
│
└── README.md            # Proje dokümantasyonu
Sunucu Bileşeni (server)
Sunucu bileşeni Vercel'e deploy edilecek ve şu işlevleri gerçekleştirecek:

WebSocket sunucusu olarak hizmet verecek
Remote Desktop istemcilerinin bağlantılarını kabul edecek ve yönetecek
Dışarıdan gelen HTTP isteklerini kabul edecek
Bu istekleri bağlı istemcilere WebSocket üzerinden iletecek
İstemcilerden gelen yanıtları HTTP yanıtı olarak döndürecek

server.js Gereksinimleri:

Express.js kullanarak bir HTTP sunucusu oluşturun
WebSocket (ws) kütüphanesi kullanarak WebSocket desteği ekleyin
Bağlı istemcileri izlemek için bir veri yapısı (Map) kullanın
İstemcilere benzersiz ID'ler atayın
Gelen HTTP isteklerini WebSocket üzerinden ilgili istemciye iletin
WebSocket bağlantılarını canlı tutmak için ping/pong mekanizması ekleyin
CORS desteği ekleyin
İstemci durumunu kontrol için /health ve /clients endpoint'leri ekleyin

package.json Bağımlılıkları:
json{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  }
}
vercel.json Yapılandırması:
json{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
İstemci Bileşeni (client)
İstemci bileşeni Remote Desktop makinesinde çalışacak ve şu işlevleri gerçekleştirecek:

Vercel sunucusuna WebSocket bağlantısı kuracak
Bağlantıyı sürekli açık tutacak ve bağlantı koptuğunda yeniden bağlanacak
Sunucudan gelen API isteklerini alacak
Bu istekleri içerideki 8081 portundaki REST API'ye iletecek
REST API'den gelen yanıtları WebSocket üzerinden sunucuya geri gönderecek

client.js Gereksinimleri:

WebSocket (ws) kütüphanesi kullanarak Vercel sunucusuna bağlanın
axios ile HTTP istekleri gönderin
Proxy yapılandırması için seçenekler ekleyin
Bağlantı koptuğunda otomatik yeniden bağlanma mekanizması ekleyin
İsteklerin ve yanıtların detaylı loglamasını yapın
Hata durumlarını ele alın ve raporlayın

package.json Bağımlılıkları:
json{
  "dependencies": {
    "ws": "^8.16.0",
    "axios": "^1.6.0",
    "node-fetch": "^2.6.9"
  }
}
Konfigürasyon Değişkenleri
Sunucuda:

PORT: Sunucunun dinleyeceği port (Vercel'de otomatik ayarlanır)
API_KEY: (İsteğe bağlı) Vercel ortam değişkeni olarak ayarlanacak basit bir API anahtarı. Ayarlanırsa, istemciden gelen isteklerin 'Authorization: Bearer <API_KEY>' veya 'X-API-Key: <API_KEY>' başlığını içermesi gerekir.

İstemcide:

VERCEL_WSS_URL: Vercel uygulamasının WebSocket URL'i
TARGET_API: İç ağdaki hedef REST API'nin URL'i
RECONNECT_INTERVAL: Bağlantı koptuğunda yeniden bağlanma süresi
Proxy ayarları (gerekirse)

Kodlama Notları

Güvenlik: Üretim ortamında uygun kimlik doğrulama mekanizmaları ekleyin. Sunucu tarafında API_KEY ortam değişkenini ayarlayarak temel bir yetkilendirme sağlayabilirsiniz.
Hata Yönetimi: Tüm hata durumları için uygun işleme mekanizmaları ekleyin.
Loglama: Debug ve sorun giderme için detaylı loglama yapın.
Timeout: İstek timeout'ları için uygun değerler belirleyin.
Bellek Yönetimi: Uzun süre çalışacak bir uygulama olduğundan bellek sızıntılarını önleyin.

Test Etme

Önce sunucu kodunu Vercel'e deploy edin
    Vercel proje ayarlarında 'API_KEY' adında bir ortam değişkeni oluşturun ve güvenli bir değer atayın.
İstemci kodunu Remote Desktop makinesine kopyalayın ve çalıştırın
Postman ile Vercel'deki endpoint'e istek gönderin ve yanıtı kontrol edin:

    https://your-vercel-app.vercel.app/api/1/your-endpoint
    Burada 1, bağlı istemcinin ID'sidir
    İstek başlıklarına (Headers) 'Authorization: Bearer <API_ANAHTARINIZ>' veya 'X-API-Key: <API_ANAHTARINIZ>' ekleyin.