// ローカルストレージのキー
const STORAGE_KEY = 'roomReservations';

// 予約データを管理するクラス
class ReservationManager {
    constructor() {
        this.reservations = this.load_reservations();
    }

    // ローカルストレージから予約を読み込む
    load_reservations() {
        const storedData = localStorage.getItem(STORAGE_KEY);
        return storedData ? JSON.parse(storedData) : [];
    }

    // ローカルストレージに予約を保存する
    save_reservations() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reservations));
    }

    // 予約を追加する
    add_reservation(room, startDateTime, endDateTime, reserverName) {
        const newReservation = {
            id: Date.now(), // ユニークIDとして現在時刻のタイムスタンプを使用
            room,
            startDateTime,
            endDateTime,
            reserverName,
            createdAt: new Date().toISOString()
        };

        // 予約時間の重複チェック
        if (this.has_time_conflict(newReservation)) {
            return { success: false, message: '選択した時間帯は既に予約されています。' };
        }

        this.reservations.push(newReservation);
        this.save_reservations();
        return { success: true, reservation: newReservation };
    }

    // 予約時間が既存の予約と重複していないかチェック
    has_time_conflict(newReservation) {
        const { room, startDateTime, endDateTime } = newReservation;
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);

        // 同じ会議室の予約のみをチェック
        return this.reservations.some(reservation => {
            if (reservation.room !== room) return false;

            const existingStart = new Date(reservation.startDateTime);
            const existingEnd = new Date(reservation.endDateTime);

            // 時間の重複チェック
            return (
                (start >= existingStart && start < existingEnd) || // 新しい開始時間が既存の予約期間内
                (end > existingStart && end <= existingEnd) || // 新しい終了時間が既存の予約期間内
                (start <= existingStart && end >= existingEnd) // 新しい予約が既存の予約を包含
            );
        });
    }

    // 予約をCSV形式に変換
    generate_csv() {
        if (this.reservations.length === 0) {
            return null;
        }

        // CSVヘッダー
        const headers = ['会議室', '開始日時', '終了日時', '予約者名', '予約日時'];
        
        // データ行
        const rows = this.reservations.map(reservation => {
            return [
                `会議室${reservation.room}`,
                this.format_date_time(new Date(reservation.startDateTime)),
                this.format_date_time(new Date(reservation.endDateTime)),
                reservation.reserverName,
                this.format_date_time(new Date(reservation.createdAt))
            ];
        });

        // CSVデータの作成
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    // 日時のフォーマット
    format_date_time(date) {
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 全ての予約を取得
    get_all_reservations() {
        return this.reservations;
    }
}

// 予約一覧表示を更新
function update_reservation_list(manager) {
    const container = document.getElementById('reservationListContainer');
    container.innerHTML = '';

    const reservations = manager.get_all_reservations();
    
    if (reservations.length === 0) {
        container.innerHTML = '<p class="no-reservations"><i class="fas fa-info-circle"></i> 予約はまだありません。</p>';
        return;
    }

    // 予約を日付順にソート
    const sortedReservations = [...reservations].sort((a, b) => 
        new Date(a.startDateTime) - new Date(b.startDateTime)
    );

    // 予約一覧を表示
    sortedReservations.forEach(reservation => {
        const item = document.createElement('div');
        item.className = `reservation-item room-${reservation.room.toLowerCase()}`;
        
        const start = new Date(reservation.startDateTime);
        const end = new Date(reservation.endDateTime);
        
        // 会議室のアイコンを設定
        const roomIcon = reservation.room === 'A' ? 'fa-tv' : 'fa-wifi';
        
        item.innerHTML = `
            <p><i class="fas fa-building"></i> <strong>会議室${reservation.room}</strong></p>
            <p><i class="fas fa-clock"></i> ${manager.format_date_time(start)} 〜 ${manager.format_date_time(end)}</p>
            <p><i class="fas fa-user"></i> ${reservation.reserverName}</p>
        `;
        
        container.appendChild(item);
    });
}

// CSVファイルとしてダウンロード
function download_csv(manager) {
    const csvContent = manager.generate_csv();
    
    if (!csvContent) {
        show_notification('ダウンロードできる予約データがありません。', 'error');
        return;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `会議室予約_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    show_notification('CSVファイルのダウンロードが完了しました。', 'success');
}

// 通知を表示する関数
function show_notification(message, type = 'info') {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 新しい通知を作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // タイプに応じたアイコンを設定
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    
    // bodyの先頭に追加
    document.body.insertBefore(notification, document.body.firstChild);
    
    // 3秒後に非表示
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// DOMの準備ができたら実行
document.addEventListener('DOMContentLoaded', () => {
    const reservationManager = new ReservationManager();
    const roomCards = document.querySelectorAll('.room-card');
    const roomSelect = document.getElementById('roomSelect');
    const reservationForm = document.getElementById('reservationForm');
    const downloadButton = document.getElementById('downloadCSV');
    const startDateTimeInput = document.getElementById('startDateTime');
    const endDateTimeInput = document.getElementById('endDateTime');

    // 現在時刻から30分後を開始時間、1時間半後を終了時間の初期値にする
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(Math.ceil(now.getMinutes() / 30) * 30); // 30分単位に切り上げ
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    
    // フォームに初期値をセット
    startDateTimeInput.value = start.toISOString().slice(0, 16);
    endDateTimeInput.value = end.toISOString().slice(0, 16);

    // 予約一覧を表示
    update_reservation_list(reservationManager);

    // 会議室カードのクリックイベント
    roomCards.forEach(card => {
        card.addEventListener('click', () => {
            // 選択状態のクラスを切り替え
            roomCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            // セレクトボックスの値を更新
            const roomId = card.dataset.room;
            roomSelect.value = roomId;
        });
    });

    // セレクトボックスの変更イベント
    roomSelect.addEventListener('change', () => {
        // カードの選択状態を更新
        roomCards.forEach(card => {
            card.classList.toggle('selected', card.dataset.room === roomSelect.value);
        });
    });

    // 予約フォームの送信イベント
    reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const room = roomSelect.value;
        const startDateTime = startDateTimeInput.value;
        const endDateTime = endDateTimeInput.value;
        const reserverName = document.getElementById('reserverName').value;
        
        // 入力チェック
        if (!room) {
            show_notification('会議室を選択してください。', 'error');
            return;
        }
        
        const start = new Date(startDateTime);
        const end = new Date(endDateTime);
        
        if (start >= end) {
            show_notification('終了時間は開始時間よりも後に設定してください。', 'error');
            return;
        }

        // 予約を追加
        const result = reservationManager.add_reservation(room, startDateTime, endDateTime, reserverName);
        
        if (result.success) {
            show_notification('予約が完了しました！', 'success');
            reservationForm.reset();
            
            // 現在時刻から30分後を開始時間、1時間半後を終了時間に再設定
            const now = new Date();
            const start = new Date(now);
            start.setMinutes(Math.ceil(now.getMinutes() / 30) * 30);
            const end = new Date(start);
            end.setHours(end.getHours() + 1);
            
            startDateTimeInput.value = start.toISOString().slice(0, 16);
            endDateTimeInput.value = end.toISOString().slice(0, 16);
            
            // 予約一覧を更新
            update_reservation_list(reservationManager);
        } else {
            show_notification(result.message, 'error');
        }
    });

    // CSVダウンロードボタンのクリックイベント
    downloadButton.addEventListener('click', () => {
        download_csv(reservationManager);
    });
}); 