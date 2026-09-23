package woyou.aidlservice.jiuiv5;

import android.os.Parcel;
import android.os.Parcelable;

/**
 * The Sunmi AIDL exposes TransBean for advanced buffered printing.
 * Jatek uses the text-printing methods only, but the placeholder is required
 * so the complete official interface keeps its transaction ordering.
 */
public final class TransBean implements Parcelable {
  public static final Creator<TransBean> CREATOR = new Creator<TransBean>() {
    @Override
    public TransBean createFromParcel(Parcel source) {
      return new TransBean(source);
    }

    @Override
    public TransBean[] newArray(int size) {
      return new TransBean[size];
    }
  };

  public TransBean() {}

  private TransBean(Parcel source) {}

  @Override
  public int describeContents() {
    return 0;
  }

  @Override
  public void writeToParcel(Parcel dest, int flags) {}
}