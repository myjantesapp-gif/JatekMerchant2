package ma.jatek.app

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Bridge to the built-in printer service on Sunmi handhelds (including V2 Pro).
 *
 * The web PWA cannot access this Android service. The native owner dashboard
 * uses this module when installed on the terminal and keeps browser printing
 * as its explicit fallback.
 */
class SunmiPrinterModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val MODULE_NAME = "JatekSunmiPrinter"
    private const val SERVICE_PACKAGE = "woyou.aidlservice.jiuiv5"
    private const val SERVICE_ACTION = "woyou.aidlservice.jiuiv5.IWoyouService"
    private const val EVENT_STATUS = "jatekSunmiPrinterStatus"
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val connectPromises = CopyOnWriteArrayList<Promise>()
  private var printerService: IWoyouService? = null
  private var currentStatus = "unavailable"
  private var statusMessage: String? = "Pont Sunmi non connecté"
  private var serviceBound = false

  private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      printerService = service?.let { IWoyouService.Stub.asInterface(it) }
      serviceBound = printerService != null
      if (!serviceBound) {
        setStatus("error", "Le service d’impression Sunmi est indisponible")
        resolveConnectPromises(null, "SUNMI_SERVICE_UNAVAILABLE", statusMessage!!)
        return
      }

      setStatus("ready", "Imprimante Sunmi prête")
      val result = statusMap()
      connectPromises.forEach { it.resolve(result) }
      connectPromises.clear()

      // This initializes the embedded service without making connection
      // dependent on a callback that some firmware versions omit.
      try {
        printerService?.printerInit(object : ICallback.Stub() {
          override fun onRunResult(isSuccess: Boolean) {
            if (!isSuccess) setStatus("error", "Initialisation de l’imprimante refusée")
          }

          override fun onReturnString(result: String?) = Unit

          override fun onRaiseException(code: Int, msg: String?) {
            setStatus("error", msg ?: "Erreur d’initialisation Sunmi ($code)")
          }
        })
      } catch (error: Throwable) {
        setStatus("error", error.message ?: "Initialisation Sunmi impossible")
      }
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      printerService = null
      serviceBound = false
      setStatus("disconnected", "Service d’impression Sunmi déconnecté")
    }
  }

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context?, intent: Intent?) {
      val action = intent?.action ?: return
      when {
        action.endsWith("NORMAL_ACTION") -> setStatus("ready", "Imprimante Sunmi prête")
        action.endsWith("OUT_OF_PAPER_ACTION") ||
          action.endsWith("LESS_OF_PAPER_ACTION") -> setStatus("paper_out", "Papier manquant ou presque épuisé")
        action.endsWith("PAPER_ERROR_ACITON") -> setStatus("paper_error", "Bourrage papier")
        action.endsWith("OVER_HEATING_ACITON") ||
          action.endsWith("MOTOR_HEATING_ACITON") -> setStatus("overheated", "Imprimante trop chaude")
        action.endsWith("COVER_OPEN_ACTION") ||
          action.endsWith("COVER_ERROR_ACTION") -> setStatus("cover_open", "Capot de l’imprimante ouvert")
        action.endsWith("PRINTER_NON_EXISTENT_ACITON") -> setStatus("offline", "Imprimante Sunmi non détectée")
        action.endsWith("ERROR_ACTION") -> setStatus("error", "Erreur de l’imprimante Sunmi")
      }
    }
  }

  override fun getName(): String = MODULE_NAME

  override fun initialize() {
    super.initialize()
    val filter = IntentFilter().apply {
      // Sunmi documentation contains both spellings across firmware
      // generations, so listen to the complete supported broadcast set.
      listOf(
        "woyou.aidlservice.jiuiv5.NORMAL_ACTION",
        "woyou.aidlservice.jiuiv5.OUT_OF_PAPER_ACTION",
        "woyou.aidlservice.jiuiv5.LESS_OF_PAPER_ACTION",
        "woyou.aidlservice.jiuiv5.PAPER_ERROR_ACITON",
        "woyou.aidlservice.jiuiv5.OVER_HEATING_ACITON",
        "woyou.aidlservice.jiuiv5.MOTOR_HEATING_ACITON",
        "woyou.aidlservice.jiuiv5.COVER_OPEN_ACTION",
        "woyou.aidlservice.jiuiv5.COVER_ERROR_ACTION",
        "woyou.aidlservice.jiuiv5.ERROR_ACTION",
        "woyou.aidlservice.jiuiv5.PRINTER_NON_EXISTENT_ACITON",
        "woyou.aidlservice.jiuv5.NORMAL_ACTION",
        "woyou.aidlservice.jiuv5.OUT_OF_PAPER_ACTION",
        "woyou.aidlservice.jiuv5.PAPER_ERROR_ACITON",
        "woyou.aidlservice.jiuv5.OVER_HEATING_ACITON",
        "woyou.aidlservice.jiuv5.MOTOR_HEATING_ACITON",
        "woyou.aidlservice.jiuv5.COVER_OPEN_ACTION",
        "woyou.aidlservice.jiuv5.COVER_ERROR_ACTION",
        "woyou.aidlservice.jiuv5.ERROR_ACTION",
      ).forEach(filter::addAction)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(statusReceiver, filter)
    }
  }

  @ReactMethod
  fun connect(promise: Promise) {
    printerService?.let {
      promise.resolve(statusMap())
      return
    }
    connectPromises.add(promise)
    if (serviceBound) return

    setStatus("connecting", "Connexion au service Sunmi…")
    val intent = Intent(SERVICE_ACTION).apply { setPackage(SERVICE_PACKAGE) }
    try {
      serviceBound = context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
      if (!serviceBound) {
        connectPromises.remove(promise)
        setStatus("unavailable", "Ce terminal ne fournit pas le service Sunmi")
        promise.reject("SUNMI_UNAVAILABLE", statusMessage)
        connectPromises.clear()
      }
    } catch (error: Throwable) {
      connectPromises.remove(promise)
      serviceBound = false
      setStatus("error", error.message ?: "Connexion Sunmi impossible")
      promise.reject("SUNMI_CONNECT_ERROR", statusMessage, error)
      connectPromises.clear()
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    if (serviceBound) {
      try {
        context.unbindService(serviceConnection)
      } catch (_: IllegalArgumentException) {
        // The Android service was already disconnected.
      }
    }
    serviceBound = false
    printerService = null
    setStatus("disconnected", "Imprimante Sunmi déconnectée")
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun printText(text: String, promise: Promise) {
    val service = printerService
    if (service == null) {
      promise.reject("SUNMI_NOT_CONNECTED", "Connectez l’imprimante Sunmi avant d’imprimer")
      return
    }
    setStatus("printing", "Impression en cours…")
    try {
      service.printText(text, printingCallback(promise, addTrailingWrap = true))
    } catch (error: Throwable) {
      setStatus("error", error.message ?: "Impression Sunmi impossible")
      promise.reject("SUNMI_PRINT_ERROR", statusMessage, error)
    }
  }

  @ReactMethod
  fun printReceipt(receipt: ReadableMap, promise: Promise) {
    val service = printerService
    if (service == null) {
      promise.reject("SUNMI_NOT_CONNECTED", "Connectez l’imprimante Sunmi avant d’imprimer")
      return
    }
    val text = renderReceipt(receipt)
    setStatus("printing", "Impression du ticket en cours…")
    try {
      service.setAlignment(0, object : ICallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {
          if (!isSuccess) {
            rejectOnMain(promise, "SUNMI_FORMAT_ERROR", "Réglage du ticket refusé")
            return
          }
          try {
            service.printText(text, printingCallback(promise, addTrailingWrap = true))
          } catch (error: Throwable) {
            rejectOnMain(promise, "SUNMI_PRINT_ERROR", error.message ?: "Impression Sunmi impossible", error)
          }
        }

        override fun onReturnString(result: String?) = Unit
        override fun onRaiseException(code: Int, msg: String?) {
          rejectOnMain(promise, "SUNMI_FORMAT_ERROR", msg ?: "Réglage du ticket impossible")
        }
      })
    } catch (error: Throwable) {
      setStatus("error", error.message ?: "Préparation du ticket impossible")
      promise.reject("SUNMI_PRINT_ERROR", statusMessage, error)
    }
  }

  private fun printingCallback(promise: Promise, addTrailingWrap: Boolean): ICallback =
    object : ICallback.Stub() {
      override fun onRunResult(isSuccess: Boolean) {
        if (!isSuccess) {
          rejectOnMain(promise, "SUNMI_PRINT_ERROR", "L’imprimante a refusé le ticket")
          return
        }
        if (!addTrailingWrap) {
          resolvePrint(promise)
          return
        }
        try {
          printerService?.lineWrap(3, object : ICallback.Stub() {
            override fun onRunResult(wrapped: Boolean) {
              if (wrapped) resolvePrint(promise)
              else rejectOnMain(promise, "SUNMI_PRINT_ERROR", "Le ticket n’a pas pu être finalisé")
            }

            override fun onReturnString(result: String?) = Unit
            override fun onRaiseException(code: Int, msg: String?) {
              rejectOnMain(promise, "SUNMI_PRINT_ERROR", msg ?: "Fin d’impression impossible")
            }
          })
        } catch (error: Throwable) {
          rejectOnMain(promise, "SUNMI_PRINT_ERROR", error.message ?: "Fin d’impression impossible", error)
        }
      }

      override fun onReturnString(result: String?) = Unit
      override fun onRaiseException(code: Int, msg: String?) {
        rejectOnMain(promise, "SUNMI_PRINT_ERROR", msg ?: "Erreur Sunmi ($code)")
      }
    }

  private fun resolvePrint(promise: Promise) {
    setStatus("ready", "Ticket imprimé")
    mainHandler.post { promise.resolve(statusMap()) }
  }

  private fun rejectOnMain(promise: Promise, code: String, message: String, error: Throwable? = null) {
    setStatus("error", message)
    mainHandler.post { promise.reject(code, message, error) }
  }

  private fun resolveConnectPromises(result: WritableMap?, code: String, message: String) {
    connectPromises.forEach { promise ->
      if (result != null) promise.resolve(result) else promise.reject(code, message)
    }
    connectPromises.clear()
  }

  private fun setStatus(state: String, message: String) {
    currentStatus = state
    statusMessage = message
    mainHandler.post {
      if (context.hasActiveCatalystInstance()) {
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_STATUS, statusMap())
      }
    }
  }

  private fun statusMap(): WritableMap = Arguments.createMap().apply {
    putString("state", currentStatus)
    putString("message", statusMessage)
    putBoolean("connected", printerService != null)
  }

  private fun renderReceipt(receipt: ReadableMap): String {
    val width = 32
    val output = StringBuilder()
    fun value(key: String): String = if (receipt.hasKey(key) && !receipt.isNull(key)) receipt.getString(key) ?: "" else ""
    fun number(key: String): Double = if (receipt.hasKey(key) && !receipt.isNull(key)) receipt.getDouble(key) else 0.0
    fun line(text: String = "") { output.append(text).append('\n') }
    fun centered(text: String) {
      val clean = text.trim()
      if (clean.length >= width) line(clean.take(width)) else line(" ".repeat((width - clean.length) / 2) + clean)
    }
    fun money(amount: Double): String = String.format(Locale.US, "%.2f", amount)
    fun separator() = line("-".repeat(width))

    centered(value("restaurantName"))
    if (value("address").isNotBlank()) centered(value("address"))
    if (value("phone").isNotBlank()) centered(value("phone"))
    if (value("ice").isNotBlank()) centered("ICE ${value("ice")}")
    separator()
    centered(value("reference"))
    if (value("createdAt").isNotBlank()) centered(value("createdAt"))
    centered("CODE CUISINE : ${value("kitchenCode").ifBlank { "—" }}")
    separator()
    line("Client : ${value("userName")}")
    wrap(value("deliveryAddress"), width).forEach(::line)
    if (value("notes").isNotBlank()) {
      line("Note :")
      wrap(value("notes"), width).forEach(::line)
    }
    separator()

    val items = if (receipt.hasKey("items") && !receipt.isNull("items")) receipt.getArray("items") else null
    if (items != null) {
      for (index in 0 until items.size()) {
        val item = items.getMap(index) ?: continue
        val quantity = if (item.hasKey("quantity") && !item.isNull("quantity")) item.getInt("quantity") else 1
        val name = if (item.hasKey("menuItemName") && !item.isNull("menuItemName")) item.getString("menuItemName") ?: "Article" else "Article"
        val total = if (item.hasKey("totalPrice") && !item.isNull("totalPrice")) item.getDouble("totalPrice") else 0.0
        wrap("${quantity}x $name", width - 10).forEachIndexed { lineIndex, itemLine ->
          line(if (lineIndex == 0) itemLine.padEnd(width - 10) + money(total).padStart(10) else itemLine)
        }
      }
    }
    separator()
    line("Sous-total".padEnd(width - 10) + money(number("subtotal")).padStart(10))
    line("Livraison".padEnd(width - 10) + money(number("deliveryFee")).padStart(10))
    line("TOTAL MAD".padEnd(width - 10) + money(number("total")).padStart(10))
    separator()
    centered("Merci pour votre commande")
    return output.toString()
  }

  private fun wrap(text: String, width: Int): List<String> =
    text.trim().split(Regex("\\s+")).fold(mutableListOf()) { lines, word ->
      if (lines.isEmpty() || lines.last().length + word.length + 1 > width) lines.add(word.take(width))
      else lines[lines.lastIndex] = "${lines.last()} $word"
      lines
    }.ifEmpty { listOf("") }

  override fun invalidate() {
    try {
      context.unregisterReceiver(statusReceiver)
    } catch (_: IllegalArgumentException) {
      // Receiver was never registered or the host already tore it down.
    }
    if (serviceBound) {
      try {
        context.unbindService(serviceConnection)
      } catch (_: IllegalArgumentException) {
        // Service was already disconnected.
      }
    }
    serviceBound = false
    printerService = null
    super.invalidate()
  }
}