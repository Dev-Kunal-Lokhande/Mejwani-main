import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class HashGen {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        System.out.println("super123 = " + encoder.encode("super123"));
        System.out.println("admin123 = " + encoder.encode("admin123"));
    }
}
