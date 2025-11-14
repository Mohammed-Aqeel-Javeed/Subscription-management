try {
    Write-Host "Testing Monthly Reminder System..." -ForegroundColor Yellow
    
    # Test debug endpoint
    Write-Host "`nStep 1: Checking subscriptions..." -ForegroundColor Cyan
    $debugResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/debug-subscriptions" -Method GET
    Write-Host "Total Subscriptions: $($debugResponse.totalSubscriptions)" -ForegroundColor Green
    Write-Host "December Renewals: $($debugResponse.decemberRenewals)" -ForegroundColor Green
    
    if ($debugResponse.decemberSubscriptions.Count -gt 0) {
        Write-Host "`nDecember Subscriptions Found:" -ForegroundColor Green
        foreach ($sub in $debugResponse.decemberSubscriptions) {
            Write-Host "  - $($sub.serviceName) (Owner: $($sub.owner)) - Renews: $($sub.renewalDate)" -ForegroundColor White
        }
    } else {
        Write-Host "No December subscriptions found!" -ForegroundColor Red
    }
    
    # Test reminder trigger
    Write-Host "`nStep 2: Triggering monthly reminders..." -ForegroundColor Cyan
    $reminderResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/monthly-reminders/trigger" -Method POST
    Write-Host "Success: $($reminderResponse.success)" -ForegroundColor Green
    Write-Host "Message: $($reminderResponse.message)" -ForegroundColor White
    
    if ($reminderResponse.data) {
        Write-Host "Renewals Found: $($reminderResponse.data.renewals.Count)" -ForegroundColor Green
        Write-Host "Emails Sent: $($reminderResponse.data.emailsSent)" -ForegroundColor Green
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}