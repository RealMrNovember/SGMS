; Faz 19.3: sessiz/tamamen otomatik güncelleme (electron-updater) için kurulum artık
; kullanıcı bazlı (perMachine: false) — yönetici izni istemez, UAC penceresi çıkmaz.
; Bu yüzden sabit "Program Files" hedefi kaldırıldı; electron-builder'ın varsayılan
; kullanıcı bazlı kurulum dizini (%LOCALAPPDATA%\Programs\SGMS Resepsiyon) kullanılıyor.

; Windows'un ikon önbelleği, güncellenen bir sürümün yeni ikonunu bazen göstermeyi
; reddedip eski ikonu göstermeye devam eder (görev çubuğu/masaüstü/başlat menüsü
; farklı görünür — bkz. roadmap.md Faz 19.1). Kurulum/güncelleme sonrası mevcut
; kullanıcı oturumu için ikon önbelleğini temizleyip Explorer'ı yeniden başlatarak
; yeni ikonun hemen ve tutarlı şekilde görünmesini sağlıyoruz. Başarısız olsa bile
; kurulumu durdurmaz (yalnızca görsel bir iyileştirmedir).
!macro customInstall
  ExecWait '"$SYSDIR\ie4uinit.exe" -ClearIconCache'
  ExecWait 'taskkill /F /IM explorer.exe'
  Exec '"$WINDIR\explorer.exe"'
!macroend
