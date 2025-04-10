ebSocket REST API Proxy - Kurulum Talimatları
Bu sistem, şirket ağı içindeki REST API'lere güvenli bir şekilde dışarıdan erişim sağlamak için tasarlanmıştır. İki ana bileşenden oluşur:

Vercel Sunucusu: Dış dünyaya açık, gelen API isteklerini kabul eder ve WebSocket üzerinden şirket ağındaki istemciye iletir.
Remote Desktop İstemcisi: Şirket ağı içinde çalışır, WebSocket aracılığıyla Vercel'e bağlanır ve aldığı istekleri içerideki API'ye iletir.

1. Vercel Uygulamasını Kurma

GitHub'da yeni bir repo oluşturun
Aşağıdaki dosyaları repo'ya ekleyin:

server.js - Ana sunucu kodu
package.json - Bağımlılıklar
vercel.json - Vercel yapılandırması


Vercel hesabınıza giriş yapın (https://vercel.com)
"New Project" seçin ve GitHub reponuzu bağlayın
Deploy etmeden önce, Vercel proje ayarlarına gidin.
    "Settings" -> "Environment Variables" bölümüne gidin.
    'API_KEY' adında yeni bir değişken ekleyin.
    Değer olarak güvenli bir anahtar belirleyin (örn: rastgele uzun bir dize).
    Bu anahtarı not alın, API isteklerinde kullanacaksınız.
Deploy butonuna basın.
Deploy ettikten sonra Vercel'in size verdiği URL'i not alın (örn: https://your-app.vercel.app)

2. Remote Desktop İstemcisini Kurma

Remote Desktop makinesinde yeni bir klasör oluşturun
client.js ve package.json dosyalarını bu klasöre kopyalayın
client.js dosyasındaki şu değişkenleri düzenleyin:

VERCEL_WSS_URL: Vercel uygulamanızın URL'ini wss:// protokolü ile girin (örn: wss://your-app.vercel.app)
TARGET_API: İç REST API'nizin URL'i (örn: http://localhost:8081)
Şirket proxy'si kullanıyorsanız, ilgili ayarları da yapılandırın


Klasöre geçin ve bağımlılıkları yükleyin:
cd /path/to/folder
npm install

İstemciyi başlatın:
node client.js

İstemci bağlandığında, konsolda "Connected to Vercel server!" mesajını görmelisiniz.
İstemcinin her zaman çalışır durumda kalması için (isteğe bağlı):

Windows'ta bir servis olarak yapılandırabilirsiniz
Ya da işlem yöneticisinde her zaman başlat şeklinde ayarlayabilirsiniz



3. Mac'ten API'yi Kullanma

Postman'i açın
Yeni bir istek oluşturun:

Metod: POST, GET, PUT, vb. (API'nize uygun olanı seçin)
URL: https://your-app.vercel.app/api/1/your-endpoint
Burada 1 ilk bağlanan istemcinin ID'sidir (normalde 1 olacaktır)
your-endpoint iç REST API'nizdeki endpoint'tir


İsteğin gövdesini ve başlıklarını normal bir API isteği gibi ayarlayın
    "Headers" bölümüne gidin.
    'Authorization' adında yeni bir başlık ekleyin ve değerini 'Bearer <API_ANAHTARINIZ>' olarak ayarlayın (Vercel'de belirlediğiniz anahtarı kullanın).
    Alternatif olarak, 'X-API-Key' başlığını kullanıp değerini sadece <API_ANAHTARINIZ> olarak da ayarlayabilirsiniz.
İsteği gönderin

Bağlantı Durumunu Kontrol Etme
Vercel uygulaması ve istemci arasındaki bağlantıyı kontrol etmek için:
GET https://your-app.vercel.app/health
Bu endpoint size bağlı istemci sayısını gösterecektir.
Bağlı istemcilerin listesini görmek için:
GET https://your-app.vercel.app/clients
Güvenlik Notları

Bu sistem varsayılan olarak kimlik doğrulama içermez.
Üretim ortamında kullanmadan önce:

    Sunucu tarafında 'API_KEY' ortam değişkenini ayarladığınızdan emin olun.
    API isteklerine bir API anahtarı veya JWT doğrulama ekleyin
    WebSocket bağlantılarını güvenli hale getirin
    İstemci ve sunucu arasındaki iletişimi şifreleyin
Rate limit ekleyin



Sorun Giderme

İstemci bağlanamıyorsa:

Şirket güvenlik duvarı ayarlarını kontrol edin
WebSocket bağlantılarına izin verildiğinden emin olun
Proxy ayarlarını doğrulayın


İstekler iletilmiyorsa:

İstemci konsolunu kontrol edin
Vercel log'larını inceleyin
Endpoint URL'ini doğrulayın


Bağlantı düşüyorsa:

İstemci otomatik olarak yeniden bağlanacaktır
Kurumsal proxy timeout ayarlarını kontrol edin


